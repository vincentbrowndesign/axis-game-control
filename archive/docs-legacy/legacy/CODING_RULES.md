# Coding Rules

These rules exist to keep AXIS stable across Codex sessions.

## Read First

Before making changes, read:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- the doc for the subsystem being changed

For Next.js code, read the relevant guide in `node_modules/next/dist/docs/` before writing code.

## Upload Rules

- Do not mutate upload response shape.
- Do not couple inference with upload infrastructure.
- Do not call AI, memory, or inference from `/api/upload`.
- Keep upload response minimal and stable.
- Keep upload errors in the existing envelope style.

## Replay Rules

- Normalize all replay/session data before render.
- Use `normalizeReplay` as the replay boundary.
- Treat old sessions and local storage sessions as incomplete.
- Keep schema changes backward compatible.

## Memory Rules

- Memory happens after replay loads.
- Memory receives normalized session data.
- Memory should not know about storage upload internals.
- Keep memory language AXIS-native.
- Warmups are the user-facing basketball memory prompts.
- Calibration is the hidden system layer.
- Do not describe warmup collection as training data.
- Warmup progress and baseline growth must not alter upload responses.
- Comparison remains gated until a warmup baseline has enough memories.
- Warmup cards must show what Axis watches, what rhythm is being built, and progress toward unlock.

## Inference Rules

- Inference happens after replay exists.
- Inference must not block upload completion.
- Inference must not change upload response shape.
- Keep inference isolated from storage and upload metadata.
- Signal extraction must show only measured signals.
- Do not claim court, player, ball, fatigue, or decision quality detection unless actually implemented with evidence.
- Basketball-aware language must translate measured signals, not invent analytics.
- Every visible basketball statement must answer what real signal produced it.
- AI descriptions must be generated from real signals until external frame reading is implemented.
- Warmups may isolate movement contexts, but they must not claim shot, pass, dribble, fatigue, IQ, or scoring quality detection.
- CV V1 starts with `browserSignals`.
- MediaPipe Pose may run browser-side after replay load, but it must stay optional, async, and recoverable.
- Keep `openAiVisionProvider` and `onnxProvider` disabled until their real implementations exist.
- Warmup-aware reads may show proxies only when backed by browser measurements.
- Pose reads may describe geometry, rhythm, repetition, movement persistence, and baseline deviation only when backed by landmark confidence.

## UI Rules

- Preserve AXIS visual identity.
- Do not redesign UI unless explicitly asked.
- Avoid generic sports analytics language.
- Avoid forbidden labels:
  - CONTROL LOST
  - PRESSURE SPIKE
  - RUN DETECTED
  - RECOVERY WINDOW
- Prefer:
  - Memory Online
  - Context Building
  - Replay Linked
  - Footage Accepted
  - Memory Stored
  - Replay Ready
  - Warmup Added
  - Movement Stored
  - Session Added To Archive
  - Signal Read
  - Baseline Started
  - Signal Recorded
  - Archive Active
  - Basketball Read
  - Activity Waiting
  - Activity Detected
  - Record With Axis
  - Axis Watches
  - Builds Baseline
  - Baseline Building
  - Baseline Ready
  - Comparison Unlocks After 3 Warmups
  - Comparison Unlocked
  - Start Memory
  - Build Baseline
  - Movement Archived
  - Warmup
  - Baseline
  - Memory
  - Movement
  - Session
  - Signal
  - Archive

Avoid mission language:
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
  - Choose File
  - Attach Existing Clip
  - Upload Console
  - Waiting for upload
  - Signal interrupted
  - Response corrupted
  - Signal unavailable
  - Not enough signal
  - Comparison locked
  - Begin Calibration
  - Calibration

## Compatibility Rules

- Add fields defensively.
- Normalize absent or legacy values.
- Do not make rendering depend on newly migrated fields only.
- Do not break local storage replay recovery.
- Do not remove legacy aliases from normalization without a migration plan.
