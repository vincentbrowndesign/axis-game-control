# Axis Vision Layer Plan

Status: CONTRACT

Vision is a later evidence layer for Axis Routine. It is not the foundation of the routine loop.

## Product Rule

Video proof is not the foundation.

The foundation is:

```text
RoutineTemplate
-> RoutineRun
-> RoutineBlock
-> RepEvent
-> MetricsSnapshot
-> WorkoutReport
```

## Attachment Model

Vision attaches to:

- `RoutineRun`
- `RoutineBlock`
- `RepEvent`

It does not replace manual rep logging or deterministic calculations.

## Future Vision Roles

- player lock proves who the rep belongs to
- rim set anchors shooting context
- ball/shot events attach to rep evidence
- overlays render from rep timeline and report metrics
- manual attachment comes before automatic vision

## Vision Event Requirements

Every future vision output must include:

- confidence
- needsReview
- timestamp
- optional video time
- source evidence attachment

## What Comes First

1. Manual routine and rep timeline.
2. Workout Report.
3. Manual evidence attachment.
4. Reviewed vision events.
5. Automatic assistance only after review rules exist.

## What Stays Hidden Until Active

- detector output
- raw detections
- relationship data
- measurement frames
- player/rim/ball/shot overlays
- confidence displays
- model/provider details

Vision can strengthen trust later, but the routine loop must work without camera, video, AI, or internet.
