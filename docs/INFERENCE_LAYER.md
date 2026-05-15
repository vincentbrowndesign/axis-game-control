# Inference Layer

The inference layer is separate from upload infrastructure and separate from deterministic memory context.

## Purpose

Inference detects or estimates signals from replay playback or future video analysis. It may eventually support:

- court detection
- player detection
- ball tracking
- motion analysis
- sequence inference

Inference must not determine whether uploads succeed.

## Current Files

- `app/api/infer/route.ts`: placeholder inference API.
- `components/AxisReplayClient.tsx`: live frame and audio sampling during playback.
- `lib/vision/*`: early vision helper stubs.
- `engine/inferenceEngine.ts`: event-to-state inference helper.

## Boundary

Inference may run after a replay exists.

Inference must not:

- Run inside `/api/upload`.
- Change upload response shape.
- Block upload completion.
- Write upload metadata directly.
- Decide storage keys.
- Know about Supabase Storage upload internals.

## Relationship To Memory

Memory is durable session context.

Inference is signal detection.

The UI may combine memory state and live inference display after replay load, but the systems should remain isolated in code and responsibility.

## Language

Use AXIS-native signal language. Prefer:

- Context Building
- Replay Linked
- Footage Accepted
- Memory Stored

Do not introduce:

- CONTROL LOST
- PRESSURE SPIKE
- RUN DETECTED
- RECOVERY WINDOW

Avoid generic sports analytics language unless explicitly requested for a specific feature.

