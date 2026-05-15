# Upload Pipeline

The upload pipeline is stable infrastructure. It must stay small, predictable, and isolated from memory and inference.

## Purpose

Uploads should only:

- Authenticate the user.
- Validate the file.
- Normalize the file name and storage key.
- Store the file in Supabase Storage.
- Create a signed replay URL.
- Insert an `axis_sessions` row.
- Insert an `axis_uploads` metadata row.
- Return the frozen upload response envelope.

Uploads should never know about AI.

## Upload Route

Primary file:

- `app/api/upload/route.ts`

Supporting file:

- `lib/replayStorage.ts`

The route currently returns an envelope with fields such as:

- `ok`
- `replayId`
- `videoUrl`
- `createdAt`
- `error`
- `detail`

This response shape is frozen and minimal. Do not rename fields, remove fields, change field meaning, or nest existing fields differently.

## Client Contract

Primary consumer:

- `components/UploadConsole.tsx`

The client expects the current upload response. It routes to `/replay/{replayId}` and lets replay load enrich the session.

Changing the upload response shape can break replay handoff, old sessions, and future recovery flows.

## Forbidden Couplings

Do not add these to upload infrastructure:

- AI model calls.
- Inference calls.
- Memory graph generation.
- Behavioral analysis.
- Memory fields.
- Timeline fields.
- Context fields.
- Ambient replay fields.
- Replay rendering decisions.

## Upload Language

Upload language should remain AXIS-native but infrastructure-focused:

- Replay Linked
- Footage Accepted
- Memory Stored

Avoid generic sports analytics phrasing and avoid invented crisis labels.

## Safe Changes

Safe upload changes are limited to:

- Better validation that preserves accepted behavior.
- More reliable storage handling.
- Better error handling using the existing error envelope.
- Internal logging improvements.
- Storage metadata persistence that does not add memory or inference fields.

Unsafe upload changes include:

- Changing the upload response envelope.
- Moving memory inference into upload.
- Calling `/api/infer` from upload.
- Making old upload responses incompatible with `UploadConsole`.
