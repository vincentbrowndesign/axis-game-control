# Claude Axis Instructions

Read `AGENTS.md` first.

This file is development guidance only. Do not import it into the app, expose it through a route, copy it into UI, or place it in `public`.

Axis adds capabilities through the stable loop:

```text
Input Source
-> Signal Adapter
-> Capability Run
-> AxisEvidence
-> AxisSessionObject
-> AxisMemoryPage
```

Do not add dashboards, fake scores, provider UI, SDK debug UI, or a new screen for every capability.

Current active release: Axis A1.2 - Open Command Toolbar (camera + player lock + open command toolbar + local evidence). See `docs/axis/AXIS_A1_ARCHITECTURE.md` for the full architecture map.
