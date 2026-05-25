# Replay Schema

Replay/session data must be normalized before render. Old sessions must never break after schema changes.

## Data Sources

Replay data can come from:

- `axis_sessions` rows.
- Upload response session objects.
- Local storage handoff under `axis-session-{id}`.
- `/api/replay/[id]` recovery responses.
- Legacy or partial rows with missing metadata.

Every source may be incomplete. Treat all replay data as untrusted until normalized.

## Normalization Boundary

Primary file:

- `lib/normalizeReplay.ts`

Use `normalizeReplay` before passing data into UI rendering or memory inference.

Normalization should:

- Accept unknown raw data.
- Read both camelCase and snake_case fields.
- Provide safe defaults.
- Convert timestamps into numbers.
- Normalize `source`.
- Normalize `environment`.
- Normalize tags.
- Normalize timeline events.
- Preserve older sessions with missing metadata.

## Render Shape

Primary type:

- `ReplaySessionView` in `types/memory.ts`

Important render fields include:

- `id`
- `createdAt`
- `source`
- `videoUrl`
- `title`
- `mission`
- `player`
- `environment`
- `duration`
- `status`
- `fileName`
- `tags`
- `memoryCount`
- `lastSignal`
- `archiveStatus`
- `context`
- `contextLine`
- `timeline`
- `timelineEvents`
- `ambientLine`
- `memoryState`

UI should render `ReplaySessionView`, not raw database rows.

## Backward Compatibility

Schema changes must be additive and defensive.

When adding fields:

- Add defaults in `normalizeReplay`.
- Accept absent values.
- Accept old metadata formats.
- Avoid requiring new fields to render old sessions.
- Keep old local storage objects recoverable.

When changing field meaning:

- Prefer adding a new field instead.
- Keep old field support in normalization.
- Do not make replay rendering depend on migration-only data.

## Signed URLs

Persisted `file_path` is the durable storage reference. Signed URLs are temporary render conveniences.

Replay loaders may refresh `video_url` from `file_path` before normalization.

## Rule

No replay/session data renders until it has crossed the normalization boundary.

