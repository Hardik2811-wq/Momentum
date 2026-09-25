---
trigger: always_on
description: Comprehensive UX and UI design guidelines for bottom navigation bars on mobile devices.
---

# Bottom Navigation Bar Design Guidelines & Rules

## 1. Information Architecture & Tab Structure
- **Prioritize Core Screens**: Focus only on the most important, frequently used screens (Home, Search, Create, Notifications, Profile).
- **Exclude Infrequent Actions**: Never place Log out, legal pages, or Help/FAQ in the bottom navigation.
- **No Top Nav Elements**: Avoid top navigation controls (back buttons, forward buttons, brand logos) inside the bottom bar.
- **Center Prominent CTAs**: When including primary creation actions (Create, Post, Quick Add), place them centered for ergonomic prominence.
- **Strict Tab Limit**: Limit tabs to 3–5 items (maximum 6). Fewer tabs give more breathing room and prevent choice paralysis.
- **Know Your Users**: Calibrate complexity and terminology to user age, tech comfort, device types, and core workflows.

## 2. Touch Targets & Ergonomic Geometry
- **Icon Sizing**: Maintain ~24 pixels icon size.
- **Label Sizing**: Set text labels to 10–12 pixels.
- **Minimum Tap Target**: Minimum 44×44 pixels touch area per tab (thumb-friendly).
- **Respect Home Indicator**: Always preserve the ~34px bottom home indicator safe area (`pb-[env(safe-area-inset-bottom)]`). Never overlap, crowd, or hide it.
- **Device Sizing**: Design and test for 2–3 standard mobile device widths; verify ergonomics on physical devices (e.g. Figma Mirror).

## 3. Typography & Labels
- **Concise Single-Line Labels**: Labels must remain strictly single-line. Never wrap to 2 lines (causes visual clutter and excessive nav height).
- **Audience Sizing**: Include text labels for older / less tech-savvy users; icon-only navigation is suitable only for tech-savvy audiences with unambiguous metaphors.
- **Guiding Role**: Labels guide navigation without competing with main canvas content.

## 4. Iconography & Active States
- **Unified Icon Style**: Stick to one consistent icon style across all tabs. Never mix flat-minimalist with hyper-detailed icons.
- **Multi-Property Active States**: Trigger at least 2 visual changes for active state (e.g. outline-to-filled icon transition + brand color shift + bolder text weight).
- **Familiar Metaphors**: Use simple, widely recognized icons (e.g. magnifying glass for search). Avoid artistic or ambiguous interpretations.
- **No Tab Enclosures**: Avoid borders or box outlines around individual tabs (causes visual noise).

## 5. Color Harmony & Content Separation
- **Neutral Navigation Container**: Keep nav bar backgrounds neutral (white, subtle gray, dark tones). Reserve saturated brand colors for active states and primary CTAs.
- **Separation from Canvas**: Separate nav bar from content using a 1px subtle border, soft drop shadow, or subtle background tone contrast.
- **Color Discipline**: Avoid different colors per tab (creates visual chaos). Stick strictly to brand palette with muted inactive tones.
- **Inactive States**: Reduce opacity or use neutral slate/gray instead of harsh contrasting colors.
- **Accessibility Contrast**: Maintain at least 3:1 contrast ratio minimum (WCAG guideline).

## 6. Notification Badging
- **Placement**: Top-right corner of the target icon.
- **Badge Polish**: Add a subtle contrasting outline around badges for crisp visual separation.
- **Readable Typography**: Badge numbers must remain legible without tiny or stylized fonts.
- **Avoid Fatigue**: Badge only essential notifications to prevent user alert fatigue.

## 7. Motion & Micro-Interactions
- **Immediate Tap Feedback**: Provide instant visual feedback on press (scale-down active state, subtle ripple, or color pulse).
- **Animated State Transitions**: Use smooth micro-interactions (sliding underline, icon morphing, fade/slide screen transitions instead of abrupt cuts).
- **Fluid Polish**: Navigation must feel responsive and tactile, never static.
