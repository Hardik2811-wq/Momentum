# Technical Specification — Personal Productivity OS
### For: Coding AI Agent (build/implementation reference)
### Companion doc to: `stitch-ai-frontend-prompt.md` (visual design reference)

> **Purpose of this doc:** The Stitch prompt tells you what it should look like. This doc tells you how it should *work* — data models, business logic, calculation formulas, state transitions, and edge cases. Treat this as the source of truth for functionality; treat the Stitch output as the source of truth for visuals. Where they conflict, this doc wins on behavior, Stitch wins on layout.

---

## 0. Tech Stack Assumptions

Suggested (adjust if you have a preference):
- **Frontend:** React + TypeScript, Tailwind CSS (maps cleanly onto Stitch output)
- **State management:** Zustand or Redux Toolkit — needs to handle derived/computed state heavily (rollup progress, velocity, streaks are all *computed*, not stored directly)
- **Backend/DB:** Your call — but the data model below assumes a relational structure (Postgres-friendly) even if you end up using a document DB. Foreign-key relationships matter a lot here (dependencies, goal↔habit links).
- **Offline-first requirement (Feature #44):** This has real architectural implications — see Section 9. Decide early whether you're using IndexedDB + a sync layer (e.g., RxDB, or a custom conflict-resolution queue) because retrofitting offline-first later is painful.
- **PWA (Feature #46):** Standard service worker + manifest.json, relatively low-cost if planned from the start.

---

## 1. Core Data Model

```
GOAL
- id
- title
- why (text, REQUIRED — cannot be null, enforce at DB + form level)
- category (enum: Health, Career, Learning, Relationships, Finance, Creative, Other)
- deadline (date, nullable — goals CAN be open-ended)
- created_at
- status (enum: active, completed, archived, someday)
- color (auto-assigned per category or user-customizable)

PROJECT
- id
- goal_id (FK, nullable — a project can exist without a parent goal, 
  though the UI should nudge users to link one)
- title
- status (enum: active, completed, archived)

TASK
- id
- project_id (FK, nullable — supports both project-nested tasks AND 
  standalone tasks not part of any project)
- goal_id (FK, nullable, DERIVED from project_id if project exists — 
  but store denormalized for query performance since "tasks per goal" 
  is a very common query)
- parent_task_id (FK to self, nullable — enables subtasks, max depth 
  suggestion: 2 levels, i.e. task > subtask, don't allow infinite nesting)
- title
- description (text, nullable)
- status (enum: not_started, in_progress, completed, cancelled)
- priority (enum: low, medium, high, urgent)
- context_tags (array: @home, @laptop, @calls, @errands — extensible, 
  user can add custom ones)
- energy_required (enum: low, medium, high)
- friction_score (int, 1-5)
- due_date (datetime, nullable)
- estimated_duration_minutes (int, nullable)
- actual_duration_minutes (int, nullable — logged via timer or manual entry)
- implementation_intention_when (text, nullable)
- implementation_intention_where (text, nullable)
- completed_at (datetime, nullable)
- reschedule_count (int, default 0 — increment every time due_date changes 
  AFTER initial creation; this powers the procrastination detector)
- created_at

TASK_DEPENDENCY
- id
- task_id (FK — "this task")
- depends_on_task_id (FK — "is blocked by this task")
- (composite unique constraint on task_id + depends_on_task_id)
- NOTE: must validate no circular dependencies on write — see Section 4

HABIT
- id
- goal_id (FK, nullable — habits can exist independent of a goal)
- title
- recurrence_rule (e.g. RRULE-style: daily, weekdays, specific days, 
  every N days)
- context_tags (array, same enum as Task)
- current_streak (int, computed/cached — see Section 5)
- longest_streak (int, computed/cached)
- grace_days_available (int — resets weekly, see Section 5)
- created_at

HABIT_LOG
- id
- habit_id (FK)
- date
- status (enum: completed, missed, grace_used, skipped_future)
- note (text, nullable — captured from the non-punitive missed-task flow)

DAILY_CHECKIN (for mood/energy correlation, Feature #18)
- id
- date
- energy_level (enum: low, medium, high — user self-reports, optional)
- mood_level (int, 1-5, optional)
- note (text, nullable)

TIME_BLOCK (Feature #5)
- id
- task_id (FK)
- start_time
- end_time
- date

REFLECTION (Feature #13, #19)
- id
- period_type (enum: weekly, monthly)
- period_start_date
- what_worked (text)
- what_got_pushed (text)
- next_priority (text)
- auto_generated_summary (text — see Section 6 for generation logic)
```

---

## 2. Rollup Progress Calculation (Feature #1)

This is the backbone of the whole app — get this right first.

**Rule:** Progress is *always computed bottom-up*, never stored as a manually-set percentage at the Goal or Project level. This prevents the classic bug where a user marks a goal "80% done" by feel and it drifts out of sync with actual task completion.

```
Task progress = 0% or 100% (binary — a task is done or not; no partial 
credit unless you implement subtask-based partial completion, in which 
case: Task progress = (completed subtasks / total subtasks) * 100)

Project progress = AVG(all child task progress values)
  - Exclude cancelled tasks from the calculation entirely (don't count 
    as 0%, don't count as done — remove from denominator)
  - If a project has zero tasks, progress = 0% (not null/undefined — 
    avoid divide-by-zero, default to 0)

Goal progress = AVG(all child project progress values), 
  OR if the goal has tasks directly attached with no project 
  (project_id null), include those as if they were a "virtual project" 
  in the average
```

**Edge case to handle explicitly:** if a Goal has both Projects AND directly-attached standalone tasks, weight them appropriately — don't let one standalone task attached directly to a goal count equally against an entire project with 20 tasks. Recommended: weight by *task count*, not by *project count*, i.e.:

```
Goal progress = (sum of all completed tasks across all projects+direct tasks) 
                 / (total non-cancelled tasks across all projects+direct tasks) * 100
```

This is more intuitive than a naive average-of-averages and avoids a single trivial task skewing a goal's progress.

**Recompute triggers:** on every task status change (not on a timer/cron) — this should feel live in the UI. Recompute the immediate parent, then propagate upward (task → project → goal). Don't recompute the entire tree on every change; only walk up the specific chain that changed.

---

## 3. Time Horizon Views (Feature #2)

Not separate data — same task/goal data, different query filters and grouping:

```
Today:        due_date == today OR (recurring habit instance for today)
This Week:    due_date BETWEEN start_of_week AND end_of_week, 
              grouped by day
This Quarter: goals/projects with deadline in current quarter, OR 
              tasks with due_date in range, grouped by month
This Year:    goals with deadline in current year, grouped by quarter
5-Year Vision: goals with no deadline OR deadline > 1 year out — this 
              is more of a "vision board" query, likely goals tagged/
              filtered by a longer-term flag rather than strict date math
```

Implement as a single flexible query function `getItemsForHorizon(horizon, referenceDate)` rather than five separate hardcoded queries — you'll want to reuse this logic for the Analytics screen's date-range filtering too.

---

## 4. Dependency Chain Logic (Feature #6)

**Blocking rule:** A task with an incomplete `depends_on` relationship should be visually locked/grayed in the UI and should NOT be allowed to be marked complete via the API/backend either — validate this server-side, not just client-side (someone could hit the API directly).

```
canCompleteTask(task_id):
  dependencies = getAllDependencies(task_id)
  return dependencies.every(dep => dep.status === 'completed')
```

**Circular dependency prevention:** before inserting a new `TASK_DEPENDENCY` row, run a graph traversal (DFS/BFS) from the proposed `depends_on_task_id` to check if it eventually leads back to `task_id`. Reject the write with a clear error if so. This is a classic bug source — test it explicitly (A depends on B, B depends on C, attempt to make C depend on A → should fail).

**Unblocking cascade:** when a task is marked complete, check all tasks that have it as a dependency and update their "blocked" UI state (doesn't need to be a hard push notification, just needs to reflect correctly next time that dependent task is rendered/queried).

---

## 5. Streak & Habit Logic (Feature #7, #11, #26)

This is the feature most directly tied to Harry's stated behavioral pattern (all-or-nothing collapse after a missed day), so get the *tone* of the logic right, not just the math — the system should never present a missed day as catastrophic.

**Streak calculation:**
```
current_streak = count of consecutive days (per the habit's recurrence 
  rule — e.g., skip non-scheduled days for "weekdays only" habits) 
  where HABIT_LOG.status is 'completed' OR 'grace_used', counting 
  backward from the most recent scheduled day, stopping at the first 
  'missed' status.
```

**Streak insurance ("grace days") rules:**
- Each habit gets **1 grace day per week** (reset every Monday, or on whatever day the user's week starts).
- Grace day is auto-suggested (not auto-applied) when a scheduled day is missed AND a grace day is still available that week — the missed-task popover (see below) offers it as one of three choices.
- If grace day is used: `HABIT_LOG.status = 'grace_used'`, streak is **preserved** (does not reset), `grace_days_available` decrements to 0 for that week.
- If no grace day available and a day is missed: streak resets to 0, BUT — see "non-punitive" requirement below — this should not trigger aggressive UI treatment.
- Grace days do NOT accumulate/bank across weeks. Unused grace day expires at week end. (Keeps the mechanic simple and prevents gaming it into "skip 4 days in a row.")

**Non-punitive missed-day flow (Feature #26):**
When a scheduled habit day passes without being marked complete (detected via a daily check — either on app open or a scheduled job), do NOT auto-mark it "missed" silently and do NOT auto-reset the streak immediately. Instead:
1. Surface it via the popover described in the Stitch prompt (three choices: Reschedule / Use grace day / Break into smaller step)
2. Give the user a grace window to respond (e.g., until end of next day) before the system defaults to `missed` with no grace day applied
3. If the user picks "Break into smaller step" — this should open a lightweight flow to edit the habit itself (e.g., "Run 5km daily" → "Put on running shoes daily") rather than just logging a note. Log the change in a `habit_modification_log` if you want history, but the core behavior is: reduce friction, don't just apologize.
4. Never display streak-reset with red color, X icons, or negative language. Use neutral/amber, and phrase copy as observational ("Streak reset — you're starting a new one today") not evaluative ("You failed to maintain your streak").

---

## 6. Weekly Review Auto-Generation (Feature #13)

This should read as generated-but-human, not a templated mail-merge. Suggested approach — build it as a rule-based template engine (no need for an LLM call unless you want to add one later for the narrative summary specifically):

```
generateWeeklySummary(week_start_date):
  completed = count tasks completed in range
  planned = count tasks that had due_date in range (completed + missed + rescheduled)
  completion_rate = completed / planned
  
  best_goal = goal with largest progress % increase this week
  most_moved_metric = compare this week's completion_rate to prior 4-week avg
  
  Template selection based on completion_rate:
    >= 85%: "Strong week" tone template
    50-84%: "Steady progress" tone template  
    < 50%: "Lighter week" tone template (NEVER "bad week" — 
           frame as fact, offer no judgment)
  
  Insert computed values into template, e.g.:
  "You completed {completed} of {planned} tasks this week 
  ({completion_rate}%). '{best_goal.title}' moved from {prev_progress}% 
  to {current_progress}%."
```

If you DO want to use an LLM call for a more natural summary (optional upgrade), pass it the computed stats as structured data and constrain tone explicitly in the system prompt ("supportive coach, never guilt-inducing, factual not evaluative when the week was weak") — don't let the LLM free-associate over raw task titles without that constraint, or it'll drift into either saccharine or judgmental phrasing depending on the data.

**Gentle escalation trigger (Feature #30):**
```
checkStalledGoals():
  for each active goal:
    if goal.progress hasn't increased in the last 14 days 
       AND goal has at least 1 incomplete task:
      flag as "stalled" → surface the gentle callout in Reflections 
      screen ("Want to shrink the next step?")
  
  This should be a passive surface (shown when user visits Reflections), 
  NOT a push notification/interruption. Respect that nudging too hard 
  on a stalled goal can itself trigger avoidance.
```

---

## 7. Goal Velocity Calculation (Feature #14)

```
velocity_status(goal):
  if goal.deadline is null: return 'no_deadline' (don't compute velocity)
  
  days_elapsed = today - goal.created_at
  days_total = goal.deadline - goal.created_at
  expected_progress = (days_elapsed / days_total) * 100
  
  actual_progress = goal.progress (from Section 2 rollup calc)
  
  delta = actual_progress - expected_progress
  
  if delta > 10: return 'ahead'
  if delta >= -10 AND delta <= 10: return 'on_track'
  if delta < -10: return 'behind'
```

The ±10 threshold is a reasonable default — consider making it configurable later, but don't expose that complexity in v1.

---

## 8. Procrastination Pattern Detection (Feature #16)

Straightforward once `reschedule_count` is tracked (see data model, Section 1):

```
getProcrastinatedTasks(threshold = 3):
  return tasks WHERE reschedule_count >= threshold 
         AND status != 'completed' AND status != 'cancelled'
  ORDER BY reschedule_count DESC
```

**Important implementation detail:** increment `reschedule_count` ONLY when `due_date` is changed to a *later* date after the task already had a due date set. Do not increment on:
- Initial due date assignment (that's not a reschedule, it's a first assignment)
- Moving a due date *earlier*
- Bulk-rescheduling via a recurring task engine auto-adjustment (that's system behavior, not user procrastination — track separately if you want that data, but don't conflate it with this metric)

---

## 9. Offline-First Architecture Notes (Feature #44)

This is the highest-complexity feature on your list from an engineering standpoint — plan for it early rather than bolting it on.

**Minimum viable approach:**
1. All writes go to local storage first (IndexedDB), UI updates optimistically/immediately
2. A sync queue tracks pending changes (create/update/delete operations with timestamps)
3. When connectivity returns, queue flushes to backend in order
4. Conflict resolution: last-write-wins is acceptable for v1 given this is a single-user personal app (not collaborative editing) — you do NOT need operational transforms or CRDTs unless you add the accountability-partner sharing feature with concurrent edits, which is out of scope for the 25 features you selected
5. Service worker caches the app shell (HTML/CSS/JS) for the PWA requirement (Feature #46) — this is separate from data sync but often implemented together

**What to explicitly test:** create a task offline, go back online, verify it syncs. Edit the same task on two "devices" while one was offline, verify last-write-wins doesn't silently destroy data without at least a console warning/log (full conflict UI is a nice-to-have, not required for v1).

---

## 10. Natural Language Quick-Add Parsing

*(Referenced in the Stitch prompt's Task Modal — noting the parsing logic here since it's functional, not visual)*

Minimum viable parser should extract, in this priority order:
1. **Date/time** — look for explicit dates ("next Friday", "tomorrow", "March 15", "5pm") — a library like `chrono-node` (JS) handles this well, don't hand-roll date parsing
2. **Tags** — `#word` pattern → maps to context_tags or a project/goal reference if it matches an existing title
3. **Priority** — `!high`, `!urgent`, `!low` pattern, or bare `!` defaults to high
4. Remaining text after extraction = task title

```
Input: "Submit report next Friday 5pm #work !high"
Output: {
  title: "Submit report",
  due_date: <next Friday 5pm, computed from today>,
  context_tags: ["work"],
  priority: "high"
}
```

Show the parsed preview live as the user types (per the Stitch design) so mis-parses are visible and correctable before submission — don't silently auto-submit a wrong interpretation.

---

## 11. State That Must Be Computed, Never Manually Set

To avoid data integrity bugs, treat these as **derived/read-only** — never expose a UI control that lets a user directly edit them:

- Goal progress %, Project progress %
- Habit current_streak, longest_streak
- Goal velocity_status
- Task reschedule_count
- Any heatmap/analytics aggregate

If you're tempted to add a "manually override progress" field because it's convenient during early development/testing, gate it behind a dev-only flag and remove before this goes in your portfolio — a user-editable progress override defeats the entire point of the rollup system and will look like a bug to anyone reviewing the code.

---

## 12. Suggested Build Order

Given the interdependencies above, build in this sequence rather than screen-by-screen:

1. **Data layer first:** Goal/Project/Task models + the rollup progress calculation (Section 2) — get this correct and tested before building any UI on top of it
2. **Task CRUD + dependency logic** (Section 4) — including the circular-dependency guard
3. **Today/Time-horizon views** (Section 3) — these are read queries against the data layer you just built, good validation step
4. **Habit/streak engine** (Section 5) — the most behaviorally-important feature, and self-contained enough to build/test in isolation
5. **Dashboard** — ties together rollups + streaks + heatmap, good integration checkpoint
6. **Analytics screen** (velocity, procrastination detection) — depends on everything above already working
7. **Reflections/weekly review** — depends on analytics data existing
8. **Offline sync layer** — retrofit-resistant, so either build this from the start (recommended) or accept it's a significant refactor later
9. **PWA/install polish** — last, low-risk to defer

---

## 13. Testing Priorities (if you want test coverage for portfolio credibility)

Highest-value things to have actual test cases for, since they're the parts most likely to have subtle bugs a code reviewer would notice:

- Goal progress rollup with mixed projects + standalone tasks (Section 2 edge case)
- Circular dependency rejection (Section 4)
- Streak calculation across a grace-day usage (Section 5) — especially the "streak preserved" case
- Velocity calculation at exactly the ±10 boundary (Section 7)
- Reschedule count NOT incrementing on initial due-date assignment (Section 8)

These five test cases, more than UI polish, are what would signal to a technical reviewer that you actually thought through the logic rather than just wiring up a pretty frontend.
