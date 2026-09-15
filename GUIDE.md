# Momentum Application Guide

## Purpose and scope

Momentum is a local-first personal productivity dashboard. The React application under `src/` is the active application. It combines task tracking, time blocking, goals, habits, reflection, a focus timer, and summary displays.

This guide documents behavior implemented in the code as it exists. A visual label is not described as a live integration unless the application performs that integration.

## Application shell

`src/main.jsx` mounts `App`. `App` owns the active tab and the Quick Add modal state. `useStore` owns all persisted workspace data and supplies it to each tab.

### Desktop sidebar

The desktop sidebar is visible from the `md` breakpoint upward.

| Element | Render and objective | Behavior |
| --- | --- | --- |
| Traffic-light dots | Three colored decorative circles. | No application action. |
| Momentum mark and “Personal OS” wordmark | Brand block with version badge. | Informational. |
| Quick Add | Full-width blue primary button. | Opens the shared Quick Add task modal. |
| Dashboard, Today, Goals, Habits, Reflections, Analytics, Settings | Icon-and-label navigation rows. Active row becomes a raised white pill. | Switches the active tab without changing the URL. |
| Profile card | Initials, name, role, and chevron. | Uses profile values from Settings. Clicking it opens Settings. |

### Mobile shell

On mobile, the sidebar is replaced by a fixed bottom tab bar. It renders the same seven destinations with compact labels. `Review`, `Stats`, and `Config` are mobile labels for Reflections, Analytics, and Settings. A floating circular plus button opens Quick Add.

### Header

The fixed header renders the current tab name, search, a visual “Synced” badge, and a notification button.

* **Search** searches task and goal titles in memory. It returns at most five results. Selecting a task changes to Today; selecting a goal changes to Goals. It does not open a matching record.
* **Ctrl/Cmd+K** focuses search. **Escape** closes search and the notification menu.
* **Notification bell** opens a recent-task list, sorted by creation time. It is not a notification inbox.
* **Synced badge** is visual only. The current application does not have a remote sync service.

### Shared overlays

| Overlay | Objective | Behavior |
| --- | --- | --- |
| Quick Add modal | Fast task capture. | Opens from sidebar, mobile plus button, dashboard, Today timeline, and empty timeline state. Supports Escape and clicking its backdrop to close. |
| Task Detail modal | Full task editing. | Opens when task rows or timeline blocks are selected. |
| Confirm modal | Protect destructive Settings and Goal actions. | Requires explicit confirm or cancel. |
| Toast stack | Feedback and undo. | Task, goal, and habit deletion show an Undo action; ordinary toasts expire. |
| Focus timer bar | Persistent timer and anchor-task control. | Renders unless Settings hides it. |

## Shared task model and Quick Add

A task can contain title, priority, category, due-date horizon, start time, duration, context, energy requirement, linked goal, completion state, notes, subtasks, creation timestamp, and completion timestamp.

Quick Add renders a centered dialog with these controls:

* Task title, required to save.
* Due-date horizon: Today, Tomorrow, This Week, or Someday/Backlog.
* Priority: High, Normal, Low.
* Optional start time and duration. Duration is disabled until a start time exists.
* Context: Laptop, Home, Calls, or Errands.
* Energy: High, Medium, or Low.
* Optional strategic goal link.
* Cancel and Add Task buttons.

Submitting inserts a task at the beginning of the task list, persists it, shows a toast, and closes the dialog. When Today opens Quick Add from a timeline hour, it passes that hour as the initial start time.

## Dashboard tab

The Dashboard is the default tab. It combines current task, habit, goal, and timer statistics.

| Section | Visual representation | Objective and connections |
| --- | --- | --- |
| Daily greeting | Large time-sensitive greeting and profile name. | Uses current time and Settings profile name. |
| Customize button | Small control-palette button. | Opens a local dashboard panel with focus filters and links to Today or Goals. It does not persist a custom layout. |
| Quick Add button | Blue plus button on desktop. | Opens shared Quick Add. |
| Summary cards | Goal, habit, and focus cards. | Goal and habit cards navigate to their tabs. Focus uses logged completed focus sessions against the configured daily target. |
| Today’s Focus | Filter pills and task cards. | Filters by all, high, normal, or low priority. Checkbox toggles completion. Row opens Task Detail. Trash deletes task with toast Undo. |
| Life & Focus Balance | SVG radar chart. | Combines task completion, goal categories, habits, focus time, and computed percentages into five displayed dimensions. |
| Activity Consistency | 16-week heatmap. | Uses completed task dates and habit check-in days. Each cell changes intensity by activity count. |
| Personal Records | Metric cards. | Displays derived streak, completed task, goal, and focus values. |
| Active Horizons | Goal-card grid. | Each card shows progress, days left, target date, category color, and task count. Clicking a card or View Goals changes to Goals. |

Selecting a dashboard task opens Task Detail. Task completion, deletion, and editing immediately update Dashboard, Today, goal active-task counts, analytics, and reflection metrics.

## Today tab

Today is a filtered task execution board plus a time-block timeline.

### Filters and task blocks

* **Horizon pills:** All Horizons, Today, This Week, This Quarter, Backlog/Someday.
* **Context pills:** All Contexts, Laptop, Home, Calls, Errands.
* **Energy pills:** All Energies, High, Medium, Low.
* **Clear filters:** appears when any filter is active and resets all three filters.

Filtered tasks are placed in visual groups: Morning Focus Block, Afternoon Execution Block, and Evening Habits & Restoration. Primary placement is based on priority; fallback placement distributes tasks if a priority group is empty.

Each task row can show priority marker, category, context, energy, due horizon, schedule, and linked-goal information. Its controls are:

* Completion checkbox toggles task completion.
* Three-dot menu exposes Edit and Delete.
* Row selection opens Task Detail.

### Time Blocked Today

The right-side calendar is a fixed 08:00–20:00 ruler with hourly rows, a live current-time line, and scheduled task blocks.

* **Day / 3-Day selector:** changes displayed label and notice. Scheduled blocks remain derived from current task data; it does not model separate future-day task dates.
* **Hour rows:** clicking an hour opens Quick Add prefilled with that time and Today horizon.
* **Scheduled blocks:** tasks with a start time and duration are positioned by pixel calculation. Color reflects high priority, Meeting category, or other tasks. A `NOW` pill appears during the scheduled interval. Clicking a block opens Task Detail.
* **Empty state:** explains that no time blocks exist and offers `Block First Time` at 09:00.
* **Add New Task:** opens Quick Add for Today.
* **Strategic Horizon Alignment card:** informational visual; it has no separate action.

## Task Detail modal

Task Detail edits an existing task. It includes title; due-date horizon; priority; start time; duration; context; energy; linked goal; notes; and a subtask checklist.

Subtasks can be added, toggled, and removed within modal state. Save writes edited task fields to the store. Delete removes the parent task and closes the modal. Cancel and close discard unsaved modal changes.

## Goals tab

Goals renders strategic goals, task linkage, manual progress, and a matrix view.

| Control or section | Objective and behavior |
| --- | --- |
| Grid / Matrix switch | Changes between individual goal cards and Eisenhower-style status columns. |
| Add Goal | Opens inline Create New Goal form. Form takes title, Career/Health/Creative category, days left, and a required rationale. Save creates a goal with zero progress. |
| Category filters | All, Career, Health, and Creative filter goal cards. Count badges reflect matching goals. |
| Goal card | Shows category, velocity label, rationale, circular progress ring, days left, launch text, progress bar, key results, and linked active-task count. |
| Circular progress button | Increases that goal’s stored progress by 5 percentage points, capped at 100. |
| Delete icon | Opens destructive confirmation for that goal. |
| Matrix | Separates currently filtered goals by `behind`, `on-track`, `ahead`, and completed status. Matrix card dots use goal color. |

Tasks may store `goalId`. The store derives each linked goal’s active task count from uncompleted tasks. Goal progress is currently manual; task completion does not change it.

## Habits tab

Habits combines daily check-ins, streak display, grace-day copy, and a visual history area.

| Section | Objective and behavior |
| --- | --- |
| Header and “Mindful Momentum” banner | Decorative product framing and habit summary. “Live Sync Active” is visual only. |
| Grace Protocol | Shows or hides explanatory grace-day panel. |
| New Habit | Opens New Habit modal. |
| Completion ring and metric pills | Shows current computed daily completion percent, longest streak, total grace days, and several visual metrics. Some supporting figures are presentation copy rather than calculated history. |
| Daily / Weekly toggle | Changes selected visual state only; it does not alter habit calculations or rendered data. |
| Habit card | Shows icon, title, duration, linked-goal text, description, streak, grace-day count, seven local-calendar days, and today check-in control. |
| Today check-in | Adds/removes today’s date in `completedDays`, updates streak-related stats, and may play a completion chime. |
| Habit menu | Opens Delete; browser confirmation precedes removal. |
| Grace actions | Available buttons call `useGraceDay`, which decrements a habit’s remaining grace-day count when above zero. |
| Annual Consistency Matrix | Large visual heatmap/presentation area. Its future buffer and several labels are static visual content. |
| New Habit modal | Captures title, duration, Material Symbol icon name, linked-goal text, and description; Save creates local habit with empty check-in history and zero grace days. |

Habit check-ins feed Dashboard activity heatmap, Dashboard and Analytics streak displays, and Reflection statistics.

## Reflections tab

Reflections is a weekly review workspace backed by the `reflections` store object and review history.

| Section or control | Objective and behavior |
| --- | --- |
| Weekly / Monthly switch | Changes selected display state. Existing calculations remain based on currently supplied store statistics. |
| Export Review | Creates and downloads a Markdown weekly-review file. |
| Finalize Week | Opens confirmation. Confirm creates an archived review record from current stats and reflection answers. |
| Executive Coach Narrative | Displays a narrative visual from current completion, momentum, goals, and habits. |
| Planned vs. Completed | Shows task totals and completion rate. |
| Category Balance Shift | Displays category-oriented task/goal presentation. |
| Daily Energy & Mood Telemetry | Renders daily mood controls. Selecting a rating updates `moodRatings` for that weekday. |
| Guided retrospective | Four editable prompts: what worked, what was pushed back plus reason, one priority plus target goal, and friction audit. Suggestion chips append or set field content. |
| Threshold action | Shows a browser alert about simplifying a stalled goal; it does not alter the goal. |
| Habit-tuning action | Shows a temporary notice; it does not alter a habit. |
| Archived Weekly Reviews | Expandable review cards read from `reflections.history`. |

Reflection export uses current task and score values. Finalization stores a summary record but does not advance `currentWeek` or clear the active reflection fields.

## Analytics tab

Analytics is a visual analysis view using supplied tasks, goals, habits, and stats.

* **Week, Month, Quarter, Year buttons** change displayed time-frame labels and calculation multipliers.
* **Metric cards** display execution accuracy, goal velocity, and peak cognitive hours.
* **Life Balance Wheel Evolution** is an SVG radar chart derived from goal categories, completion rate, habits, and streak values. It also renders a synthetic prior-cycle polygon.
* **Active Friction & Backlog** lists up to three incomplete tasks. If there are none, it renders sample tasks.
* **Milestone Awards & Records** shows Streak Master, Execution Velocity, and Consistency Standard cards.

Several Analytics values use display multipliers, minimum values, or sample fallbacks. They are not a historical analytics database.

## Settings tab

Settings changes local preferences and controls local data.

| Section | Controls and behavior |
| --- | --- |
| User Profile | Name, role, time zone, and work cycle inputs save on blur. Profile name and role feed sidebar and dashboard greeting. |
| Focus & Deep Work Engine | Toggle focus bar; set default focus minutes; set daily focus target; toggle automatic five-minute recovery breaks; toggle browser notifications; toggle sound effects. Test Alert and Test Chime invoke current browser APIs. |
| Data Backup & Portability | Export creates JSON containing tasks, goals, habits, reflections, settings, and focus sessions. Import reads a JSON file and restores only accepted object/array shapes. |
| Stitch AI Integration | Status and endpoint/project rows are presentation values. This tab does not invoke Stitch from the React application. |
| Workspace State & Reset | Wipe Clean clears workspace data after confirmation. Load Sample restores supplied demo tasks, goals, habits, and reflections. Reset restores all defaults and clears focus sessions after confirmation. |

## Focus timer

The floating Focus Timer Bar renders in focus or break mode.

* Mode icon switches focus and break modes.
* Play starts; Pause stores remaining time; Reset restores mode duration.
* Progress line uses elapsed percentage.
* Tune button opens task selector listing incomplete tasks. Selecting an anchor task attaches its ID to a completed focus session.
* Close hides the bar through Settings; it can be re-enabled there.
* Completing a focus interval creates a persisted focus-session record. With enabled settings, it plays a chime, attempts a desktop notification, shows a toast, and begins a five-minute break when automatic breaks are enabled.

Focus sessions feed Dashboard focus totals and daily focus-target progress. Timer state itself is not persisted across a reload.

## Data flow and persistence

`useStore` keeps these browser `localStorage` keys:

* `momentum_tasks`
* `momentum_goals`
* `momentum_habits`
* `momentum_reflections`
* `momentum_settings`
* `momentum_focus_sessions`

There is no server database, login, account, team workspace, remote synchronization, or calendar connection in current React code. Browser storage is source of truth.

### Actual cross-tab connections

1. Creating/editing/deleting/toggling a task updates Dashboard, Today, search, recent-task menu, goal active-task counts, activity heatmap, analytics, and reflection task metrics.
2. Linking a task to a goal updates that goal’s derived active-task count.
3. Habit check-ins update habit streaks, daily habit completion, Dashboard heatmap, Analytics displays, and Reflection inputs that consume stats.
4. Focus sessions update Dashboard focus totals and progress against Settings daily target.
5. Settings profile values update sidebar identity and Dashboard greeting.
6. Settings focus preferences alter timer duration, break behavior, sound, notifications, and timer visibility.
7. Backup/restore replaces persisted workspace collections, which then re-render all dependent views.

## Service worker and assets

`public/manifest.webmanifest` and generated service-worker output support installable/offline shell behavior. Build configuration writes a cache list for built application assets. External Google Fonts and the remote image in Habits still depend on network availability.

## Non-application files

Root-level `dashboard.html`, `today.html`, `goals.html`, `habits.html`, `analytics.html`, and dark variants are legacy design exports. `stitch_raw/` and `assets/` contain source/export assets. They are not mounted by `src/App.jsx`.
