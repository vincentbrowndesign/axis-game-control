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
- Calibration missions are basketball memory prompts.
- Do not describe mission collection as training data.
- Mission progress and baseline growth must not alter upload responses.

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
- Missions may isolate movement contexts, but they must not claim shot, pass, dribble, fatigue, IQ, or scoring quality detection.

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
  - Signal Read
  - Baseline Started
  - Signal Recorded
  - Not Enough Memory
  - Archive Active
  - Basketball Read
  - Activity Waiting
  - Activity Detected
  - Begin Calibration
  - Start Memory
  - Build Baseline
  - Movement Archived
  - Calibration
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

## Compatibility Rules

- Add fields defensively.
- Normalize absent or legacy values.
- Do not make rendering depend on newly migrated fields only.
- Do not break local storage replay recovery.
- Do not remove legacy aliases from normalization without a migration plan.
