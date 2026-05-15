# Memory System

The memory system is a derived layer that runs after replay data loads and normalizes.

Memory is not upload infrastructure.

## Purpose

Memory converts normalized replay/session data into AXIS context:

- session continuity
- player context
- archive status
- timeline labels
- ambient replay language
- confidence-like display state
- calibration baseline status
- mission completion context

Primary file:

- `lib/memoryInference.ts`
- `lib/calibration/buildBaseline.ts`
- `lib/calibration/types.ts`
- `lib/missions/getCalibrationMissions.ts`
- `lib/missions/types.ts`

## Inputs

Memory should receive:

- A normalized `ReplaySessionView`.
- Previously normalized sessions.
- Optional player context.
- Optional measured signal data after replay load.

Memory should not receive:

- Raw upload form data.
- Raw `File` objects.
- Supabase storage upload results.
- Upload response construction details.
- AI model responses from upload.

Calibration should stay grounded. It may compare duration, source, measured motion intensity, measured audio energy, memory count, first memory date, and latest memory date. It must not infer fatigue, control, pressure, or decision quality.

Calibration missions are basketball memory prompts, not training-data prompts. They may label a session as handle, footwork, shooting form, live movement, or transition so the baseline can store mission type, duration, motion level, audio level, completion count, and timestamp.

Each mission builds a named baseline. Comparison language stays locked until the mission has enough memories, currently three. Before unlock, use milestone language: `BASELINE BUILDING`, `1 / 3 memories`, `COMPARISON LOCKED`, and `Record 2 more to unlock read`. After unlock, use `BASELINE READY` and `COMPARISON UNLOCKED`.

## Outputs

Memory produces `MemoryState`:

- `headline`
- `status`
- `ambientLine`
- `contextLine`
- `archiveStatus`
- `memoryCount`
- `timelineEvents`
- `confidence`

These values are display context. They should be deterministic, recoverable, and safe for old sessions.

## Current Language

Preferred labels and lines:

- Memory Online
- Context Building
- Replay Linked
- Footage Accepted
- Memory Stored
- Baseline started.
- First memory stored.
- Motion level recorded.
- Session added to baseline.
- Not enough memories for comparison.
- Movement archived.
- Build baseline.
- Baseline building.
- Baseline ready.
- Comparison locked.
- Comparison unlocked.

Avoid:

- CONTROL LOST
- PRESSURE SPIKE
- RUN DETECTED
- RECOVERY WINDOW

Avoid generic sports analytics language. AXIS is not a dashboard of box score insights. It is a replay memory system.

## Isolation Rule

Do not call memory inference from `/api/upload`.

The upload route may persist minimal fallback metadata, but actual memory state belongs to replay load, replay recovery, archive rendering, and client display.

Mission selection can travel through the existing `mission` form field, but uploads must still return the frozen minimal response. Mission progress and baseline growth are replay/memory concerns after the clip exists.
