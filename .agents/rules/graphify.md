---
trigger: always_on
description: Auto-use graphify knowledge graph at graphify-out/ and auto-update after code edits without user intervention.
---

# Agent Project Rules - Graphify Automated Workflow

Strict Rules for Agents:
1. **Auto-Consult (Pre-Execution)**: For any codebase, architecture, file relationship, or bug investigation request, consult `graphify-out/graph.json` FIRST before scanning raw files. Use `graphify query "<question>"`, `graphify path`, or inspect `graphify-out/graph.json` directly. Do NOT ask user permission.
2. **Auto-Update (Post-Execution)**: Immediately after making any code edits or file changes, automatically run `graphify update .` in shell to update `graphify-out/graph.json`. Do NOT prompt user for permission or confirmation.
3. **Zero Intervention**: Perform graph querying and graph updating autonomously.