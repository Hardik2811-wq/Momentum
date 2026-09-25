---
trigger: always_on
description: Core UI/UX visual design principles, hierarchy rules, shadow mechanics, and presentation standards.
---

# UI & UX Visual Design Rules & Guidelines

## 1. Visual Hierarchy & Anti-Monotony
- **Multi-Vector Differentiation**: Combine size, weight, color, and iconography to structure information. Never present all text identically.
- **Rank Before Rendering**: List elements and rank them by user importance before writing CSS or layouts.
- **Direct User Attention**: Use contrasting scale and position to guide the eye through the layout naturally.
- **Iconography as Guidance**: Use icons as functional signposts, not mere decoration.

## 2. Data Framing: Emphasize Values Over Labels
- **Values First**: Always make the actual data, metric, or figure prominent (e.g. `591 sales` large and bold; `Total Sales` small, muted, uppercase).
- **Subordinate Labels**: Secondary metadata and field labels must sit back visually so users can scan metrics instantly.
- **Avoid Uniform Fields**: Monotonous label + value rows produce decision fatigue and scanning friction.

## 3. Elevation, Depth & Shadow Mechanics
- **Eliminate Harsh Shadows**: Never use heavy, dark, or abrupt drop-shadows. Use wide, soft blur radiuses that blend seamlessly.
- **Tinted Shadows (Background Harmony)**:
  - Never use pure neutral gray or black shadows on colored canvases.
  - Tint shadow color to the underlying background tone (e.g. subtle purple-tinted shadow over a lavender canvas).
  - Un-tinted gray shadows on colored backgrounds look dusty, jarring, and unpolished.
- **Layered Ambient Occlusion**: Combine a tiny direct contact shadow (`0 1px 2px rgba(...)`) with a wide ambient blur (`0 12px 32px rgba(...)`) for natural depth.

## 4. Product Presentation & Visual Transparency
- **Show Real Artifacts**: Show actual live screens and internal workflow pages rather than generic illustrations or plain backdrops.
- **Transparency Drives Conversions**: Demonstrating the real product interface fosters instant credibility (A/B testing: 22% plain vs 48% actual product sneak peeks).
- **Contextual Framing**: Place product previews against matching tonal backgrounds that reinforce the core value proposition.

## 5. Relentless Refinement Cycle
- **Never "Finished"**: Interfaces must undergo continuous observation, testing, and micro-tuning.
- **Perception Calibration**: Evaluate designs under real light conditions, actual mobile viewports, and authentic data densities.
