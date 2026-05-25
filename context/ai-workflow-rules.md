# AI Workflow Rules

- Work on one feature unit at a time.
- Current unit: upload -> saved session -> processing job -> complete.
- Never combine unrelated system boundaries in a single implementation step.
- After each completed unit, update `context/progress-tracker.md`.
- When a decision is needed, stop and surface it rather than guessing.
- Stay in scope.
- Do not implement clips, broadcasts, overlays, AI commentary, or Roboflow/CV until the current seam is stable.
- Extend the existing Axis project. Do not replace it.
