---
trigger: always_on
description: Mobile ergonomics, interaction cost, card architecture, empty state design, and visual cue rules.
---

# UI & UX Interaction Patterns & Architecture Rules

## 1. Card Architecture Over Monolithic Lists
- **Selectable Cards**: Convert monotonous vertical text lists into rich selectable cards.
- **Layered Interaction**: Cards provide visual appeal, icons, status tags, and contextual previews in one digestible unit.
- **Cognitive Chunking**: Cards create distinct mental containers that reduce cognitive load compared to raw table/list rows.

## 2. Interaction Cost & Direct Content Exposure
- **Eliminate Promotional Gates**: Never gate primary content behind banner clicks (e.g. "Discover 100+ items" banner creates friction and abandonment).
- **Surface the Best Immediately**: Expose top 5–10 relevant, high-utility items directly on the default canvas.
- **Minimize Tap Distance**: Every extra tap, expansion drawer, or modal reduces conversion; show value upfront.

## 3. Thumb Zone Ergonomics (Mobile Navigation)
- **Natural Arc Placement**: Place primary CTAs, critical toggles, and frequent navigation within the natural thumb sweep arc (lower third of screen).
- **No Grip Stretching**: Elements in the top corners require two hands or unnatural grip shifts; reserve top corners only for secondary, infrequent actions.
- **Fatigue Prevention**: On-the-go and one-handed mobile users drop off when primary actions live at the top of the viewport.

## 4. High-Utility Empty States (Zero Dead Ends)
- **Never Dead End**: A bare empty state (e.g. "No tasks here") is a UX failure that triggers user abandonment.
- **Educational Framing**: Explain the core value proposition of the section even when zero records exist.
- **Actionable Bridge**: Always provide:
  1. A clear single-action CTA button (e.g. `+ Add First Task`, `+ Create Project`).
  2. Starter templates or recommended presets to eliminate blank-slate paralysis.
  3. Actionable next steps or workflow tips.

## 5. Visual Cue Hierarchy & Identity Anchoring
- **Rich Identification**: Use real photos/avatars or brand logos rather than generic initials or plain text names.
- **Functional Signposts**: Pair status labels with colored badge indicators and standardized iconography to accelerate visual scanning.
- **Multi-Modal Comprehension**: Users process visual representations 60,000× faster than plain text strings.
