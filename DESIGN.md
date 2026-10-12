# Design System: Momentum OS (Android & Cross-Platform Flagship)

## 1. Visual Theme & Atmosphere
Momentum OS embodies a **tactile, high-craft Android flagship workspace** that fuses the calm editorial clarity of Things 3 and Linear with the ergonomic precision of Material 3 and Nothing OS.
- **Density:** 6/10 (Daily App Balanced) — structured information hierarchy where metrics, streaks, and time-blocks breathe without wasted viewport space.
- **Variance:** 6/10 (Offset Asymmetric) — asymmetric split panes on desktop/tablet that collapse into thumb-zone-first single-column stacks and bottom sheets on Android phones.
- **Motion:** 7/10 (Fluid Spring Physics) — hardware-accelerated `transform` and `opacity` transitions (`cubic-bezier(0.22, 1, 0.36, 1)`) with tactile `-1px` / `scale(0.97)` press feedback and zero linear easing.

## 2. Color Palette & Roles
- **Warm Bone Canvas** (`#F7F6F2`) — Primary light-mode background surface, reducing eye strain compared to sterile `#FFFFFF`.
- **Obsidian Carbon** (`#121214`) — Primary dark-mode background surface (never pure `#000000`).
- **Pure Elevated Sheet** (`#FFFFFF` light / `#1A1A1E` dark) — Card containers, Android bottom sheets, and floating navigation bars.
- **Recessed Well** (`#F0EFF5` light / `#222228` dark) — Segmented controls, input wells, and inactive pill containers.
- **Charcoal Ink** (`#161618` light / `#F7F6F2` dark) — Primary typography, active icons, and high-contrast primary CTAs.
- **Muted Steel** (`#6B6A72` light / `#8E8E93` dark) — Secondary labels, metadata captions, and inactive navigation states.
- **Hairline Whisper Border** (`rgba(0, 0, 0, 0.07)` light / `rgba(255, 255, 255, 0.08)` dark) — 1px structural separation for cards, timelines, and sheets.
- **Sapphire Signal Accent** (`#0F52BA` light / `#6495ED` dark) — Primary interactive accent for active navigation indicators, focus rings, and timeline progress.
- **Semantic Status Tokens:**
  - **Forest Ritual** (`#2E6F40` / `#10B981`) — Habit streaks, C-Block ritual containers, and completion states.
  - **Terracotta Alert** (`#C84B31` / `#F43F5E`) — Live current-time laser line, overdue deadlines, and destructive actions.

## 3. Typography Rules
- **Display & UI Sans:** `Plus Jakarta Sans` (with system fallback to `Roboto` on Android) — track-tight (`-0.02em`), weight-driven hierarchy (`500` medium, `600` semibold, `700` bold).
- **Editorial Masthead:** `Newsreader` — reserved strictly for top-level section mastheads and date headers (`letter-spacing: -0.015em`).
- **Monospace Telemetry:** `JetBrains Mono` (`font-variant-numeric: tabular-nums`) — mandatory for all timestamps, durations, countdowns, streak counters, and percentages.
- **Scale & Readability:** Minimum body/control text `12px`–`14px` on mobile; single-line truncation on navigation labels; 65ch maximum line width on prose notes.
- **Banned:** Generic `Inter` dominance, `Times New Roman`, or unstyled browser default inputs.

## 4. Component Stylings
- **Android Bottom Navigation Bar (`MobileTabBar`):**
  - Neutral translucent container (`#FBFBFA/95` light, `#161619/95` dark) with `backdrop-blur-2xl` and 1px top hairline border.
  - Active state triggers 3 simultaneous changes: **Material 3 pill indicator** (`56px × 28px` rounded-full tint), filled 24px icon (`"FILL" 1`), and bold `11px` single-line label.
  - Centered **Squircle Primary FAB** (`48px × 48px`, `rounded-2xl`) positioned in the natural thumb arc, opening a bottom-anchored creation sheet.
  - Strictly preserves `env(safe-area-inset-bottom)` for the Android gesture navigation pill.
- **Android Bottom Sheet Modals (`HabitModal`, `QuickAddModal`, `GoalModal`, `TaskDetailModal`, `ScheduleDetailModal`):**
  - On mobile viewports (`< 640px`), all creation and edit dialogs dock to the bottom edge (`items-end`) with `rounded-t-[28px]` top corners, a centered `40px × 4px` drag handle pill, smooth internal scrolling (`max-h-[92dvh]`), and a sticky bottom action bar padded for `env(safe-area-inset-bottom)`.
- **Calendar Scratch C-Blocks & Overlapping Lanes (`TodayView`):**
  - Habits overlapping shorter tasks wrap around them as structural **Focus C-Blocks** (top header arm with puzzle tab, left 14px spine, recessed inner task slot, and 12px bottom jaw clamp).
  - Non-container overlaps partition into deterministic side-by-side lanes (`width = 100 / totalCols%`) with zero text collision.
- **Buttons & Touch Targets:**
  - Minimum `44px × 44px` tap target on all mobile controls.
  - Tactile press response (`active:scale-[0.97]`) with zero neon outer glows.

## 5. Layout Principles
- **Edge-to-Edge Android Viewport:** Respects `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` across all fixed headers, floating action buttons, and bottom sheets.
- **Mobile-First Single-Column Collapse (`< 768px`):** Multi-pane desktop grids collapse cleanly into single-column cards or segmented views (`Timeline` vs `Task Tray`) with zero horizontal overflow.
- **Values Over Labels:** Numeric metrics (`85%`, `14d`, `45m`) lead in bold `JetBrains Mono`, while descriptive labels sit subordinate in muted uppercase tracking.

## 6. Motion & Interaction
- **Sheet Choreography:** Bottom sheets enter via `androidSheetUp` (`cubic-bezier(0.22, 1, 0.36, 1)`, `240ms`) using GPU-accelerated `transform: translateY(...)` and `opacity`.
- **Micro-Interactions:** Checkboxes pop via `checkPop` spring keyframe; live status dots pulse subtly; numeric counters roll via odometer transitions.
- **Performance:** Animate exclusively `transform` and `opacity`. Never animate `top`, `left`, `width`, or `height`.

## 7. Anti-Patterns (Banned)
- No desktop-only floating center modals on mobile phones — always use bottom-anchored sheets on `< 640px`.
- No purple/blue neon cyberpunk glows or oversaturated gradients.
- No pure black (`#000000`) backgrounds or untinted harsh gray drop shadows.
- No 2-line wrapped labels in bottom navigation tabs.
- No tap targets smaller than `44px × 44px` on mobile controls.
- No AI copywriting clichés ("Unleash", "Next-Gen", "Elevate", "Seamless").
- No filler scroll prompts ("Scroll to explore", bouncing chevrons).
