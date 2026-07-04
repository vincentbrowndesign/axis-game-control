# Claude Axis Instructions

Read `AGENTS.md` first.

This file is development guidance only. Do not import it into the app, expose it through a route, copy it into UI, or place it in `public`.

Axis is a Sports Biomechanics Video Agent: camera and SDKs are Axis seeing, visual overlays are Axis speaking, the open command toolbar is the user talking back, evidence is what Axis saves, memory is what Axis compounds.

Axis adds capabilities through the stable loop:

```text
Input
-> Tool / SDK / API
-> Evidence
-> Memory
-> Export / Recall
```

Do not add screens for capabilities. Do not reintroduce old workflow buttons (Mark Moment, Analyze, Last Moment, Correct, Not Right, test selectors, measurement dashboards). Camera output is visual, toolbar input is open, evidence is saved metadata, memory is the future product layer. One capability at a time. Do not add dashboards, fake scores, provider UI, SDK debug UI, or a new screen for every capability.

Current active release: Axis A1.2 - Open Command Toolbar (camera + player lock + open command toolbar + local evidence). See `docs/axis/AXIS_A1_ARCHITECTURE.md` for the full architecture map.
