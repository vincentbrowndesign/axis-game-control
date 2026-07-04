# Axis Vision Agent Instructions

This folder owns the Axis vision pipeline.

Do not build UI here.
Do not create dashboards here.
Do not add product copy here.

## Current Vision Loop

```text
Camera frame
-> detector
-> tracker
-> VisionRead
-> AI moment interpreter
-> AxisEvidence
```

## Detection Priority

Start with only:

1. player
2. ball
3. rim

Optional later:

- court
- defender
- hoop zone
- shot arc
- make/miss

Do not claim make/miss until ball and rim evidence supports it.

Do not claim shot attempt unless player, ball, and rim motion supports it.

## Active Providers

Use Hugging Face for object detection.

Use MediaPipe for pose only when pose is needed.

Do not use Roboflow in the active path.

## API Rule

Do not call Hugging Face every animation frame.

Allowed Hugging Face calls:

- captured frame
- sampled frame
- marked moment
- saved rep
- background job

## Token Rule

`HF_TOKEN` must stay server-side.

No client-side Hugging Face token.

No `NEXT_PUBLIC_HF_TOKEN`.

## Output Rule

Raw detector output must be normalized into `AxisVisionRead`.

Do not leak provider-specific shapes into product UI.

## Required Types

Use these concepts:

- `AxisDetectedObject`
- `AxisObjectTrack`
- `AxisVisionRead`
- `AxisMotionHint`
- `AxisEvidence`

## Confidence Rule

High confidence: `ready`

Medium confidence: `needs_review`

Low confidence: `uncertain`

Never fake certainty.
