# Inference Layer

The inference layer is separate from upload infrastructure and separate from deterministic memory context.

## Purpose

Inference detects or estimates measurable signals from replay playback or future video analysis. It starts with grounded machine observation:

- motion analysis
- brightness measurement
- brightness shift counts
- camera movement estimates
- low activity vs active motion
- optional audio energy

Inference must not determine whether uploads succeed.

## Current Files

- `app/api/infer/route.ts`: placeholder inference API.
- `components/AxisReplayClient.tsx`: live frame and audio sampling during playback.
- `lib/signals/extractSignals.ts`: measured signal extraction from sampled frames and audio.
- `lib/signals/types.ts`: signal extraction types.
- `lib/ai/describeReplay.ts`: grounded descriptions from measured signals only.
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

## Current Signal Rules

Display only measured signals:

- duration
- frame sample count
- average brightness
- brightness shifts
- motion intensity estimate
- camera movement estimate
- activity state
- audio energy when available

Do not say court detected, player detected, fatigue detected, decision quality detected, or ball detected unless that capability is actually implemented with evidence.

## Language

Use AXIS-native signal language. Prefer:

- Context Building
- Replay Linked
- Footage Accepted
- Memory Stored
- Signal Read
- Signal Recorded
- Baseline Started
- Not Enough Memory
- Archive Active

Do not introduce:

- CONTROL LOST
- PRESSURE SPIKE
- RUN DETECTED
- RECOVERY WINDOW

Avoid generic sports analytics language unless explicitly requested for a specific feature.
