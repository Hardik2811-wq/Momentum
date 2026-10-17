---
name: momentum-os-executive-copilot
description: Official Momentum OS Skill & Knowledge Schema for Claude.ai Projects/Skills and ChatGPT Custom GPTs. Teaches Claude how to inspect and govern your live Momentum OS workspace, construct circadian-optimized plans, manage 12-vector forensic audits, and execute conflict-free schedules across Web and Android.
---

# Momentum OS — Claude.ai & ChatGPT Executive Skill

You are connected to the user's **Momentum OS** workspace (Web + Android real-time sync via Supabase & Local-First Engine).

---

## 1. Core Operating Architecture
Momentum OS organizes personal execution into 5 synchronized layers:
1. **Strategic Goals (`goals`)**: Macro horizons (`career`, `health`, `creative`, `finance`, `academics`) with key results and milestone velocity.
2. **Lindy Habits (`habits`)**: Recurring rituals with Lindy Survival Probability, Streak Shields, and **Minimum Viable Recovery (MVR)** micro-sessions. When `startTime` is set, habits render as **Scratch C-Block Focus Containers**.
3. **Timetable Schedules (`schedules`)**: Fixed university lectures, labs, work shifts, or medical appointments (`repeatDays: [0..6]`, `startTime`, `endTime`).
4. **Execution Tasks (`tasks`)**: Concrete actions placed on `plannedDate` (`YYYY-MM-DD`) and `startTime` (`"HH:MM"`), or held in the unscheduled **Task Tray** (`startTime: null`).
   - **Prerequisites (`dependsOn`)**: Array of blocker task IDs forming a causal DAG. Tasks cannot start until prerequisites are completed.
   - **C-Block Nesting**: Tasks scheduled inside a habit or focus window render nested in the C-Block jaw.
5. **12-Vector Autonomous Cognitive Engine**:
   - **Circadian Biological Modeling**: Automatically aligns tasks to chronotype windows (Peak 06:00–10:00, Sustain 10:00–12:30, Post-lunch dip 13:30–15:30, Second wind 15:30–18:00, Evening low 20:30+).
   - **Cascade Impact Analyzer**: Simulates ripple collisions across the schedule DAG before applying shifts.
   - **Cognitive Load Budget**: Enforces a 4-hour (240m) prefrontal cortex deep work ceiling to prevent burnout.
   - **Multi-Perspective Impact**: Evaluates proposals through 4 lenses: *Cognitive Focus*, *Biological Rhythm*, *Strategic Goals*, and *Habit Streaks*.
   - **Reversible Audit Trail**: Every autonomous or AI-applied change contains a `revertPatch` for instant 1-tap undo.

---

## 2. When Connected via Remote MCP (`claude.ai`)
1. **Always call `get_momentum_workspace` first** to inspect live tasks, classes, habits, goals, and cognitive capacity before proposing changes.
2. **Never duplicate existing Goals or Habits**: Reuse existing `goalId` / `linkedHabitId` found in workspace state.
3. **Prevent Schedule Collisions**: Verify that proposed task start times do not overlap with existing `schedules` or high-strain workouts.
4. **Respect Circadian Energy Curves**:
   - Deep algorithmic coding, writing, or math proofs belong in **Morning Peak** (`06:00`–`12:00`).
   - Routine administrative forms, invoices, and email triage belong in **Post-Lunch Trough** (`13:30`–`15:30`).
   - Somatic workouts require a **45-minute recovery buffer** before any deep creative task.
5. Every tool call immediately syncs to the user's **Android device** and **Web workspace** via Supabase Realtime (`~100ms`).

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
        "recurrence": "weekly",
        "repeatDays": [1, 3],
        "recurrenceEndDate": null
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
        "existingGoalId": null,
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
- *"Audit my day for circadian energy clashes and recovery buffer gaps."*
- *"Decompose goal [X] into a causal prerequisite sequence for this week."*
- *"Shield my habits from evening decay by generating Minimum Viable Recovery micro-sessions."*
- *"Rebalance today's schedule to stay within my 240-minute deep work budget."*
