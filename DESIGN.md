# Momentum OS — High-Level Frontend Architecture Blueprint (`DESIGN.md`)

> **Status:** Step 1 — Architectural Planning Blueprint. Awaiting user approval before code implementation.  
> **Rule Compliance:** Local-only. No Git commits, no GitHub pushes, no Android syncs.

---

## 1. Visual Thesis: The Quiet Precision Instrument
- **Core Philosophy:** Moving away from corporate SaaS slop (monotonous gray bento-boxes, floating neon pill containers, saturated primary-blue washes, and generic icon cards).
- **Design Pattern:** **Sleek Editorial with Cardless Segmentation**.
  - Surfaces structure through whitespace tension, hairline architectural dividers (`1px` with subtle tone contrast), and typographic scale rather than enclosing every metric into rounded cards.
  - Feels like a combination of a Swiss chronometer, an architect's field notebook, and a terminal monitor.
- **Tone & Atmosphere:** Calm at first glance, forensically detailed upon focus. Restrained motion: spring physics only on state changes; zero ambient decorative spinning particles or mesh gradients.

---

## 2. Design System Tokens & Hierarchy

### Typography Hierarchy (High-Contrast Editorial Pairing)
| Role | Family | Weight / Tracking | Usage Constraints |
|---|---|---|---|
| **Editorial Masthead** | `Newsreader` (Serif) | 400 / 600, `-0.02em` | View titles, orientation statements, narrative summaries. Never used for buttons or data rows. |
| **Operational Sans** | `Plus Jakarta Sans` | 500 / 600, `-0.01em` | Primary labels, button text, form inputs, navigation items. |
| **Telemetry & Time** | `JetBrains Mono` | 500 / 700, `tabular-nums` | All metrics, percentages, timestamps, durations, streaks, confidence scores. |

### Calibrated Color Palette (Anti-Slop Color Discipline)
- **Canvas Base:** `#F7F6F2` (Warm Linen Light) / `#121214` (Obsidian Titanium Dark).
- **Secondary Well:** `#EFECE6` Light / `#1A1A1E` Dark (used strictly for recessed input fields & active segments).
- **Dividers & Structural Rules:** `rgba(0, 0, 0, 0.08)` Light / `rgba(255, 255, 255, 0.08)` Dark (hairline border segmentation).
- **Ink:** `#161618` Primary / `#6B6A72` Secondary Light; `#F7F6F2` Primary / `#8E8E93` Secondary Dark.
- **Directional Signals (Sparse, functional accents only):**
  - **Sapphire Signal** (`#0F52BA` / `#6495ED`): Active focus, primary action stroke, interactive timeline needle.
  - **Forest Ritual** (`#2E6F40` / `#10B981`): Habit Lindy survival, completed prerequisites.
  - **Terracotta Urgency** (`#C84B31` / `#F43F5E`): Live time-line laser, slipped schedules, cognitive overload warning.

### Spacing & Grid Constraints
- **Vertical Rhythm:** 48px–64px desktop macro-section separation; 24px–32px mobile.
- **Micro-Gaps:** 4px, 8px, 12px, 16px strictly snapped to 4px baseline.
- **Cardless Segmentation:** Thick column rules (`border-r border-hairline`) and horizontal dividers (`border-b border-hairline`) replace elevation shadows and container padding bloat.

---

## 3. Component Architecture to Build

### Component 1: Hero & Real-Time Executive Command Suite
- **Location:** Embedded in `DashboardView` / Main Canvas.
- **Layout:** Asymmetric Split-Screen Instrument.
  - **Left (45%): Editorial Masthead & Circadian Command.**
    - High-contrast `Newsreader` serif headline: *"Time is biological, not mechanical."*
    - Live Circadian Biological Phase indicator (Current zone, e.g., `PEAK_COGNITIVE 06:00–10:00`, with live energy score meter).
    - Quick Action Horizon: Single tactile trigger to run Forensic Neural Scan or quick-capture next deliverable.
  - **Right (55%): Asymmetrical Kinetic Instrument Preview.**
    - Interactive live timeline strip showing active C-Block habit container, nested task deliverable, and live Terracotta laser time-needle.
    - Hover / tap state triggers instant contextual telemetry preview without modal popups.

### Component 2: SaaS Analytics & Cognitive Horizon Hub (Cardless Ledger)
- **Location:** Embedded in `AnalyticsView` / Dedicated Executive Horizon Hub.
- **Layout:** Cardless Columnar Ledger (3 distinct column segments bounded by hairline vertical rules).
  - **Segment A: Prefrontal Cognitive Budget Ledger.**
    - Values-first telemetry: Deep work consumption (`180m / 240m`), admin willpower spend, and fatigue crash forecast time (`16:15`) in large `JetBrains Mono`.
  - **Segment B: Multi-Horizon Burndown & Goal Velocity.**
    - Weekly goal burndown curve with monochrome high-contrast axes and sapphire milestone markers.
    - 72-Hour upcoming deadline pressure monitor.
  - **Segment C: Prerequisite Causal DAG & Habit Lindy Survival.**
    - Causal dependency flow: Blocker tasks connecting via clean SVG orthogonal step-lines to unblocked targets.
    - Habit Lindy Decay probability gauges.

---

## 4. Execution Plan (Post-Approval)
1. **Implementation:**
   - Create `src/components/executive/ExecutiveCommandHero.jsx` (Hero & Feature Suite).
   - Create `src/components/executive/ExecutiveHorizonLedger.jsx` (Cardless Analytics Hub).
   - Integrate into `DashboardView.jsx` and `AnalyticsView.jsx` behind a clean toggle/tab.
2. **Local Verification:**
   - Run `npm run build` locally.
   - Run local dev server (`http://localhost:5173`) and test across viewports: 375px (mobile), 768px (tablet), 1280px (desktop).
   - Verify zero layout shift, WCAG 3:1 contrast minimum, 44px touch targets.
   - **Do not commit or push to Git/Android.**
