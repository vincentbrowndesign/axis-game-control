# AXIS Architecture

AXIS is a replay memory system. It accepts video footage, stores it as stable replay infrastructure, normalizes session data, then layers memory and inference on top after replay load.

The upload path, replay path, memory system, inference layer, and UI language are intentionally separate. Future changes should keep those boundaries intact.

## Core Flow

1. A user uploads or records footage.
2. `/api/upload` validates the file and stores it.
3. `/api/upload` creates an `axis_sessions` row and an `axis_uploads` record.
4. The client receives a frozen, minimal upload response.
5. Replay pages load persisted session data.
6. Replay/session data is normalized through `normalizeReplay`.
7. Memory state is derived after normalization.
8. Inference runs independently from upload infrastructure.
9. UI renders normalized replay data using AXIS language.

## Boundaries

Uploads are infrastructure. They should only answer: did the file arrive, where is it stored, and which session represents it?

Replay is the renderable product surface. It should receive normalized session data and display it safely even when older rows have missing fields.

Memory is a derived layer. It should inspect normalized replay/session data and previous sessions, then produce AXIS memory language.

Inference is a signal layer. It may inspect playback or video-derived signals, but it must not participate in upload storage or response construction.

## Primary Files

- `app/api/upload/route.ts`: stable upload ingest route.
- `components/UploadConsole.tsx`: upload client and local replay handoff.
- `lib/replayStorage.ts`: file, source, environment, and text normalization for upload storage.
- `lib/normalizeReplay.ts`: replay/session normalization before render.
- `lib/memoryInference.ts`: derived memory state after replay load.
- `app/replay/[id]/page.tsx`: server replay hydration.
- `app/api/replay/[id]/route.ts`: replay recovery API.
- `components/AxisReplayClient.tsx`: replay UI, local recovery, live playback signal sampling.
- `app/sessions/page.tsx`: replay archive.

## Architectural Rules

- Do not couple upload infrastructure to AI, inference, memory, or analysis.
- Do not mutate the upload response shape.
- Do not render raw session rows directly.
- Do not let schema changes break old sessions.
- Do not redesign AXIS UI unless explicitly asked.
- Preserve AXIS identity, tone, typography, and signal language.

