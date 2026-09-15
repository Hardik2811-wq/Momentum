# MOMENTUM OS — System Documentation & User Manual

Momentum OS is an executive personal productivity system built on intentional architecture, cognitive load theory, and long-horizon goal compounding.

---

## 1. System Architecture & Core Navigation

The interface uses a fixed 248px left sidebar, persistent top header, and fluid primary viewport.

### Sidebar Navigation
- **Workspace Identity**: Displays user workspace identity (`Elena Vance • Personal OS`).
- **Tab Selection**: Switches between 6 primary operational contexts:
  1. `Dashboard` — System overview, daily balance, active horizon status.
  2. `Today` — Tactical execution stream, energy-based filters, calendar blocking.
  3. `Goals` — Long-term objective matrix, milestone pacing, key result tracking.
  4. `Habits` — Daily ritual tracker, active streaks, grace day engine.
  5. `Analytics` — Velocity metrics, estimation accuracy, category distribution.
  6. `Settings` — Focus parameters, notification thresholds, data storage controls.
- **Quick Action (`+ Quick Add`)**: Universal modal to register tasks with priority (`High`, `Normal`, `Low`), category tagging, and date targets.
- **Storage Mode**: Local-first persistence via browser `localStorage`. Zero telemetry, instant offline reload.

---

## 2. Shell & Universal Controls

### Top Header
- **View Breadcrumb**: Shows the currently active workspace tab.
- **Global Search (`⌘K` / `Ctrl+K`)**:
  - Live fuzzy matching across active tasks and strategic goals.
  - Interactive dropdown showing direct matches.
  - Selection navigates straight to the target view.
  - `Esc` dismisses search state.
- **Notification Center (Bell Icon)**:
  - Dropdown log of the 3 most recently created tasks and system events.
- **User Avatar**: Visual anchor for active profile.

### Quick Add Modal
- Accessible via sidebar button, header plus button, or inline list triggers.
- Fields: Task title, Category (`Deep Work`, `Meetings`, `Habits`, `Personal`), Priority tag (`P1 High`, `P2 Normal`, `P3 Low`), Horizon date.
- Submit persists task immediately to local state and updates metrics across all views.

---

## 3. Tab-by-Tab Breakdown

---

### TAB 1: Dashboard (`DashboardView`)

The morning briefing deck. Aggregates micro-commitments with macro-direction.

#### A. Header & Horizon Indicators
- **Greeting & System Status**: Live date display and active cognitive state badge (`Focus Mode Active`).
- **Action Buttons**:
  - `Customize View`: Configuration shortcut.
  - `+` (Add): Quick add modal trigger.

#### B. 4-Pack Metric Deck
1. **Tasks Due Today**:
   - Displays count of pending tasks remaining.
   - Shows priority breakdown (`X High`, `Y Normal`).
   - Purpose: Immediate assessment of critical-path workload.
2. **Completion Rate**:
   - Visual percentage of daily tasks completed (`completed / total * 100`).
   - Ratio count tracker (`X of Y tasks completed`).
   - Purpose: Measures daily execution efficiency.
3. **Goals on Track**:
   - Count of active goals maintaining pacing targets.
   - Circular SVG progress dial showing percentage of goals not flagged as `behind`.
   - `View all goals →`: Jump to Goals tab.
4. **Habits Today**:
   - Completed habits counter against total tracked rituals.
   - Best active day-streak counter.
   - `View habits →`: Jump to Habits tab.

#### C. Focus Stream (Left Column — 60%)
- **Segmented Filter**:
  - `All`: View every registered task.
  - `High Impact`: Isolates Priority 1 (`P1`) critical initiatives.
  - `Quick Wins`: Isolates low/normal friction items to generate starting momentum.
- **Task List Elements**:
  - Checkbox circle: Click marks task complete/incomplete with strikethrough animation.
  - Category Chip: Visual domain tag.
  - Priority Badge: Red (`Priority 1`), neutral (`Normal`), subtle (`Low`).
  - Delete Button (`×`): Visible on hover. Removes item with confirmation.
- **Inline Trigger**: "Add focus item for today..." opens creation workflow directly in context.

#### D. Life & Focus Balance (Right Column — 40%)
- **Radar Equilibrium Chart**:
  - 5-point pentagon plotting holistic life distribution: `Career`, `Health`, `Learning`, `Creative`, `Social`.
  - Highlights over-indexing in career vs. deficits in recovery or creative exploration.
- **Category Progress Bars**: Real-time velocity ratings (`Peak`, `Optimal`, `Under Target`).
- **Micro-Insight Callout**: Algorithmic suggestion based on lowest quadrant score.

#### E. Consistency Heatmap & Trophies
- **16-Week Consistency Matrix**: GitHub-style grid mapping activity density across 112 days.
- **Personal Records**: High-water marks for longest streak, all-time task volume, and aggregate consistency.

#### F. Active Horizons
- 3 primary strategic cards showing days remaining, target deliverables, key result completion, and radial pacing rings.

---

### TAB 2: Today (`TodayView`)

The tactical workstation for direct daily execution and calendar synchronization.

#### A. Horizon Pill Switcher
- Filter execution scope: `Today`, `This Week`, `This Quarter`, `This Year`, `5-Year Vision`.
- Anchors current tactical steps to longer time horizons.

#### B. Context & Energy Filter Bar
- **Context Filters**:
  - `@Home`: Remote/domestic actions.
  - `@Laptop`: Focused machine execution.
  - `@Calls`: Communication blocks.
  - `@Errands`: Physical/external errands.
- **Energy Level Selector**:
  - `Low`: Administrative and maintenance tasks.
  - `Medium`: Standard meetings and routine reviews.
  - `High` (`⚡`): Deep cognitive problem-solving, architecture, drafting.
- Dynamic indicator updates guidance text based on active energy setting.

#### C. Structured Time Streams
1. **Morning Focus (9:00 AM – 12:30 PM)**:
   - High-cognitive load tasks auto-routed here.
   - Displays time estimates, linked strategic outcomes, and key result tags.
2. **Afternoon Deep Work (1:30 PM – 5:00 PM)**:
   - Secondary focus items, collaborative architecture debriefs, and multi-step sub-checklists.
   - Built-in subtask checks with strikethrough states.
3. **Evening Wind-Down (5:30 PM – 7:00 PM)**:
   - Recovery rituals, physical training runs, creative tactile habits.
- **Actions on Every Task Item**:
  - State Checkbox: Toggles completion state in real time.
  - Context Menu (`···`): Opens action drawer to delete or re-route tasks.

#### D. Apple Calendar-Style Day Timeline
- 10-hour vertical timeline grid (09:00 to 19:00).
- **Time Block Overlays**:
  - Visual duration cards mapped directly to daylight hours.
  - Current time indicator line (`1:45 PM`) showing real-time daily burn.
- `+ Add Timeblock`: Direct scheduling trigger.
- **Horizon Alignment Card**: Shows the percentage of day blocks directly tied to active quarterly milestones.

---

### TAB 3: Goals (`GoalsView`)

Strategic outcome management using Objectives and Key Results (OKR) methodology.

#### A. Header & Mode Switcher
- **Active Goals Counter**: Displays active horizons and pacing health.
- **View Toggle**:
  - `Grid View`: Multi-column card layout displaying rich details and quotes.
  - `Eisenhower Matrix`: 2x2 quadrant layout grouping goals by velocity (`Ahead of Pace`, `On Track`, `Needs Attention`).
- `+ New Goal`: Opens inline creator with title, category, why statement, and timeline inputs.

#### B. Category Filter Pills
- Filter by domain: `All Goals`, `Career & Craft`, `Health & Athletics`, `Creative & Mind`.

#### C. Goal Cards
- **Category Badge & Velocity Indicator**: Pacing label (`Ahead of pace`, `On track`, `Needs attention`).
- **Title & "Why" Statement**: The core motivational anchor justifying the objective.
- **Interactive SVG Progress Ring**:
  - Displays numerical percentage completed.
  - **Click Action**: Clicking the circular ring advances progress by **+5%**.
- **Metrics Footer**: Target completion date, active tasks linked, and key result counts.
- **Delete Trigger**: Arrow button allows permanent retirement of goals.

---

### TAB 4: Habits (`HabitsView`)

Identity-based habit compounding with failure tolerance protocols.

#### A. Pacing & Health Metrics
- **Overall Consistency**: Aggregate check-in percentage across all tracked rituals.
- **Active Streaks**: Longest unbroken cadence in days.
- **Grace Balance**: Accumulated rest credits preventing burnout streak breaks.
- **Controls**:
  - `Grace Protocol`: Displays active safety net allocations.
  - `+ New Habit`: Opens configuration modal (name, frequency, linked goal, category).
  - `Daily / Weekly`: Toggles viewing frequency.

#### B. Dynamic Habit Cards
- **Identity Header**: Habit icon, name, estimated duration, linked goal breadcrumb.
- **Interactive 7-Day History Strip**:
  - Shows last 7 calendar days with single-letter day labels (`S M T W T F S`).
  - Completed days highlighted with solid badges.
  - Incomplete days displayed as subtle outlines.
- **Today's Check-in Button**:
  - Primary button: `Complete Today` / `Completed ✓`.
  - Toggling recalculates streaks dynamically.
- **Options Menu (`···`)**: Allows deleting discontinued habits.

---

### TAB 5: Analytics (`AnalyticsView`)

Performance telemetry, cognitive distribution, and velocity tracking.

#### A. Timeframe Switcher
- Filter analytical window: `Week`, `Month`, `Quarter`, `Year`.

#### B. Core Performance Tiles
- **Estimation Accuracy**: Compares planned vs. actual completion rates.
- **Goal Velocity**: Pacing health of macro objectives.
- **Peak Cognitive Hours**: Optimal daily energy window for creative and deep focus.

#### C. Visual Diagnostics
- **Weekly Focus Allocation**: Radar and area charts mapping category time investments.
- **Deep Work vs. Shallow Work**: Ratio diagnostics preventing administrative creep.

---

### TAB 6: Settings (`SettingsView`)

Engine configuration and local data governance.

#### A. Focus Session Configuration
- Numeric inputs for default Pomodoro/Focus sprint duration (minutes) and target daily deep work hours.

#### B. Automation & Audio
- `Desktop Notifications`: Toggle alert triggers.
- `Auto-Schedule Breaks`: Toggle automatic rest buffers between blocks.
- `Sound Effects`: Audio feedback for check-ins and completions.

#### C. Profile Governance
- Edit user display name, operational title, timezone, and quarterly milestone cycle. Persists on blur.

#### D. Data Governance
- `Reset All Data`: Danger-zone trigger. Shows confirmation dialog before clearing local state and resetting to default templates.

---

## 4. Beginner's Onboarding & Operating Guide

A 4-step daily workflow to maximize output using Momentum OS.

```
┌──────────────────────────────────────────────────────────────┐
│                    DAILY MOMENTUM CADENCE                     │
│                                                              │
│   08:30 [BRIEF]      09:00 [EXECUTE]    17:30 [REVIEW]       │
│   Check Dashboard    Filter @Today      Check-in Habits      │
│   Audit Priorities   Work High-Energy   Reflect & Log        │
└──────────────────────────────────────────────────────────────┘
```

### Step 1: The Morning Alignment (08:30 – 08:45)
1. Open **Dashboard**.
2. Review **Tasks Due Today** and **Completion Rate**.
3. Inspect **Life & Focus Balance** radar:
   - Identify neglected quadrants (e.g., Creative or Health below 60%).
4. Check **Active Horizons**:
   - Ensure today's work aligns with upcoming milestones.

### Step 2: Tactical Structuring in Today (08:45 – 09:00)
1. Switch to **Today** tab.
2. Select your current physical **Context** (`@Laptop` or `@Home`).
3. Set your **Energy Level**:
   - Choose `High` for mornings to pull critical P1 tasks into Morning Focus.
4. Compare your task list against the **Time Blocked Today** calendar:
   - Match 90-minute focus sprints to open calendar slots.
   - Use `+ Add Timeblock` if adjustments are needed.

### Step 3: Deep Execution & Midday Flow
1. Execute tasks sequentially from the **Morning Focus** block.
2. Check off items directly on the UI as they finish.
   - Checkbox triggers strikethrough and immediately recalculates completion percentages.
3. Transition to **Afternoon Deep Work** after lunch:
   - Check nested sub-items on complex tasks.
4. Capture unplanned incoming tasks immediately using **`⌘K` / Quick Add** rather than context-switching.

### Step 4: Evening Wind-Down & Habit Logging (17:30 – 18:00)
1. Switch to **Habits** tab.
2. Click **Complete Today** on routines executed (Cardio, Reading, Practice).
   - Watch active streak increment.
   - If sick or traveling, trigger **Grace Protocol** to protect your unbroken streak.
3. Switch to **Goals** tab:
   - Click the progress ring on any goal that advanced today to increment by **+5%**.
4. Review **Analytics** on Friday afternoon to audit weekly velocity and recalibrate focus targets for the next cycle.
