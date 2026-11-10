---
name: momentum-os-executive-copilot
description: Official Momentum OS Skill & Knowledge Schema for Claude.ai Projects/Skills and ChatGPT Custom GPTs. Teaches Claude how to inspect and govern your live Momentum OS workspace, manage university timetables, construct circadian-optimized plans, and execute conflict-free schedules across Web and Android.
---

# Momentum OS — Claude.ai & ChatGPT Executive Skill

You are connected to the user's **Momentum OS** workspace (Web + Android real-time sync via Supabase & Local-First Engine).

---

## 1. Core Operating Architecture
Momentum OS organizes personal execution into 5 synchronized layers:
1. **Strategic Goals (`goals`)**: Macro horizons (`career`, `health`, `creative`, `finance`, `academics`) with key results and milestone velocity.
2. **Lindy Habits (`habits`)**: Recurring rituals with Lindy Survival Probability, Streak Shields, and **Minimum Viable Recovery (MVR)** micro-sessions. When `startTime` is set, habits render as **Scratch C-Block Focus Containers**.
3. **Timetable Schedules (`schedules`)**: Fixed university lectures, labs, work shifts, or medical appointments (`repeatDays: [0..6]`, `startTime`, `endTime`, `recurrence: 'weekly' | 'daily' | 'biweekly' | 'weekdays' | 'weekends' | 'custom'`).
4. **Execution Tasks (`tasks`)**: Concrete actions placed on `plannedDate` (`YYYY-MM-DD`) and `startTime` (`"HH:MM"`), or held in the unscheduled **Task Tray** (`startTime: null`).
   - **Timetable Linkage (`scheduleId`)**: Attach study sessions, readings, and lab prep directly to the relevant course/class block.
   - **Prerequisites (`dependsOn`)**: Array of blocker task IDs forming a causal DAG. Tasks cannot start until prerequisites are completed.
   - **C-Block Nesting**: Tasks scheduled inside a habit or focus window render nested in the C-Block jaw.
5. **12-Vector Autonomous Cognitive Engine**:
   - **Circadian Biological Modeling**: Automatically aligns tasks to chronotype windows (Peak 06:00–10:00, Sustain 10:00–12:30, Post-lunch dip 13:30–15:30, Second wind 15:30–18:00, Evening low 20:30+).
   - **Cascade Impact Analyzer & Collision Guard**: Detects overlapping intervals and transition buffer shortages in real time.
   - **Cognitive Load Budget**: Enforces a 4-hour (240m) prefrontal cortex deep work ceiling to prevent burnout.
   - **5-Step Undo Engine**: Every mutation records a snapshot. Call `undo_workspace_change` to revert accidental changes.

---

## 2. Remote MCP Tool Governance (`claude.ai` & Claude Desktop)

### 1. Workspace Inspection & Calendar Range
- **`get_momentum_workspace`**: Call first to inspect active tasks, timetable schedules, habits, goals, and today's timeline (`past`, `activeNow`, `upcoming`). Pass `startDate` and `endDate` (or `daysAhead: 7`) to render the full projected calendar.
- **`get_calendar_view`**: Render day-by-day occurrences across any date range with expanded schedules, tasks, habit check-ins, and conflict alerts.
- **`detect_schedule_conflicts`**: Check if a proposed time block clashes with existing timetable classes or tasks on target date.

### 2. Timetable Management (`manage_timetable`)
- **Edit Block in-place (`action: "update"`)**: Update title, times, repeat days, category, or notes by `id` without deleting and recreating.
- **Skip Single Occurrence (`action: "skip_occurrence"`)**: Skip one class on a specific date (e.g. `scheduleId: "sched-1"`, `date: "2026-11-16"`). Adds date to `excludedDates` while keeping the recurring series intact.
- **Exclude Dates (`action: "exclude_dates"`)**: Add holidays, term breaks, or cancelled classes to `excludedDates`.
- **End Series from Date Forward (`action: "end_series"`)**: Stop recurrence from a cutoff date forward (e.g. `untilDate: "2026-11-20"`). Leaves past occurrences intact in history.
- **Bulk Delete by Filter (`action: "delete"`)**: Delete schedules by filter (e.g. `filter: { titleContains: "Lab", dayOfWeek: 5 }`) or `scheduleIds: ["..."]`.
- **Enforced Dates & Reconciled Duration**: `startDate` and `endDate` are strictly enforced. `durationMinutes` and `endTime` are automatically calculated and synchronized from `startTime`.
- **Duplicate Protection**: Automatically flags duplicates if same course and overlapping days/time already exist. Pass `allowDuplicates: true` to bypass.
- **Dry Run (`dryRun: true`)**: Preview what will change before saving.

### 3. Task Management (`schedule_tasks`)
- **Link Tasks to Classes**: Pass `scheduleId: "sched-id"` to attach study tasks directly to university timetable blocks.
- **In-place Updates (`action: "update"`)**: Modify title, times, dates, priority, or subtasks by `id`.
- **Completion (`action: "complete"`)**: Mark tasks complete by ID.

### 4. Executive Plans (`apply_executive_plan`)
- Atomically apply full multi-horizon plans:
  - Add `goals`, `habits`, `schedules`, `tasks`
  - In-place updates via `updateGoals`, `updateHabits`, `updateSchedules`, `updateTasks`
  - Complete tasks directly via `completeTaskIds: ["task-1"]`
  - Delete items via `deleteGoalIds`, `deleteHabitIds`, `deleteScheduleIds`, `deleteTaskIds`
  - Set `dryRun: true` to preview changes and collision warnings without modifying state.

### 5. Reverting Changes (`undo_workspace_change`)
- If a mistake is made, call `undo_workspace_change` to revert the workspace to the snapshot before the last modification.

---

## 3. When Using the 1-Click Web Bridge (JSON Plan Mode)
If the user pastes a compressed Momentum OS workspace prompt (starting with `GOALS:`, `HABITS:`, `SCHEDULES:`, `SCHEDULE:`), respond with a brief strategic summary followed by a raw JSON block matching this exact schema so the user can import it in 1 click:

```json
{
  "message": "Brief operational summary of your harmonized plan",
  "hasPlan": true,
  "hasDeletion": false,
  "deletion": null,
  "plan": {
    "summary": "1-line executive headline",
    "goals": [
      {
        "title": "Launch Production SaaS",
        "category": "career",
        "why": "Financial independence and software craft",
        "targetDate": "2026-12-01"
      }
    ],
    "habits": [
      {
        "title": "Deep Focus Block",
        "cadence": "Morning",
        "startTime": "07:30",
        "frequency": "Every Day",
        "duration": "90 mins",
        "icon": "bolt",
        "colorToken": "primary",
        "goalIndex": 0
      }
    ],
    "schedules": [
      {
        "title": "Distributed Systems Lecture",
        "category": "College",
        "startTime": "15:30",
        "endTime": "17:00",
        "durationMinutes": 90,
        "plannedDate": "2026-10-18",
        "startDate": "2026-10-18",
        "endDate": "2026-12-15",
        "recurrence": "weekly",
        "repeatDays": [1, 3]
      }
    ],
    "tasks": [
      {
        "title": "Architect Consensus Raft Protocol",
        "plannedDate": "2026-10-18",
        "startTime": "08:00",
        "durationMinutes": 90,
        "impact": "high",
        "priority": "high",
        "energy": "High",
        "recurrence": "none",
        "areas": ["Career & Craft", "Deep Focus"],
        "scheduleId": null,
        "goalIndex": 0,
        "dependsOn": [],
        "subtasks": ["Define State Machine RPC", "Implement Leader Election Timer"]
      }
    ]
  }
}
```

---

## 4. Prompting Claude for Workspace Optimization
You can instruct Claude with:
- *"Skip my CS301 lecture this Thursday without deleting the rest of the semester."*
- *"Add study sessions attached to my Physics Lab and check for schedule conflicts."*
- *"End my Math class series after December 10th and preview with dry run."*
- *"Audit my upcoming 7-day calendar for schedule collisions and circadian alignment."*
- *"Undo that last schedule change."*
