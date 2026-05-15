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
- `lib/vision/providers/types.ts`: future-ready vision provider interface and disabled provider slots.
- `lib/vision/providers/browserSignals.ts`: browser-safe CV V1 measurement from sampled frames and audio.
- `lib/basketball/readBasketballSignal.ts`: basketball-aware state translation from measured signals.
- `lib/basketball/types.ts`: basketball signal state types.
- `lib/ai/describeReplay.ts`: grounded descriptions from measured signals only.
- `lib/missions/getCalibrationMissions.ts`: basketball calibration mission definitions.
- `lib/missions/types.ts`: mission metadata and signal-focus types.
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
- camera stability estimate
- framing consistency estimate
- motion density
- pace changes
- direction changes
- movement bursts
- repeated motion
- acceleration burst
- activity state
- audio energy when available

Do not say court detected, player detected, fatigue detected, decision quality detected, or ball detected unless that capability is actually implemented with evidence.

Basketball Signal V1 may say only grounded states:

- CLIP STORED
- SHORT CLIP
- ACTIVE MOTION
- LOW ACTIVITY
- CAMERA MOVING
- CAMERA STABLE
- AUDIO PRESENT
- AUDIO QUIET
- BASELINE STARTED
- NOT ENOUGH MEMORY
- PLAYER UNASSIGNED

These states must be derived from duration, frame sampling, pixel differences, camera movement estimate, audio energy, normalized replay data, or baseline memory count.

Computer Vision V1 is `browserSignals` only. It uses browser frame sampling after replay load and exposes real observation fields such as motion delta, brightness, camera stability, framing consistency, duration, and optional audio energy. Provider slots for `mediapipePoseProvider`, `openAiVisionProvider`, and `onnxProvider` must remain disabled until explicitly implemented.

Calibration Mission V1 gives the signal layer cleaner basketball contexts without making fake detections. Missions can focus the future archive around handle, footwork, shooting form, live movement, and transition, but the current system may only display mission completion, baseline growth, comparison lock status, and measured signal status.

Mission UI should translate what Axis watches into basketball language:

- bounce rhythm
- hand rhythm
- camera stability
- direction changes
- lower-body rhythm
- balance shifts
- release repeat
- body shape
- camera framing
- pace changes
- movement density
- live rhythm
- acceleration
- movement intensity
- camera movement

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
- Basketball Read
- Activity Detected
- Activity Waiting
- Movement Archived
- Build Baseline
- Baseline Building
- Baseline Ready
- Comparison Locked
- Comparison Unlocked

Do not introduce:

- CONTROL LOST
- PRESSURE SPIKE
- RUN DETECTED
- RECOVERY WINDOW
- assessment
- evaluation
- performance grading
- pressure score
- IQ metrics
- vector extraction
- pixel delta
- frame sampling
- model inference
- telemetry pipeline

Avoid generic sports analytics language unless explicitly requested for a specific feature.
