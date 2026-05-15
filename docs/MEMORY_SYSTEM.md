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

Primary file:

- `lib/memoryInference.ts`
- `lib/calibration/buildBaseline.ts`
- `lib/calibration/types.ts`

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

Avoid:

- CONTROL LOST
- PRESSURE SPIKE
- RUN DETECTED
- RECOVERY WINDOW

Avoid generic sports analytics language. AXIS is not a dashboard of box score insights. It is a replay memory system.

## Isolation Rule

Do not call memory inference from `/api/upload`.

The upload route may persist minimal fallback metadata, but actual memory state belongs to replay load, replay recovery, archive rendering, and client display.
