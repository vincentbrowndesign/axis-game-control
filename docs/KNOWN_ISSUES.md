# Known Issues

This file tracks architectural risks and current rough edges so future agents do not solve them by breaking boundaries.

## Upload Response Is Fragile By Design

`components/UploadConsole.tsx` expects the current `/api/upload` response shape. This shape is frozen:

- `ok`
- `replayId`
- `videoUrl`
- `createdAt`
- `error`
- `detail`

Do not fix upload issues by changing the response envelope.

## Upload Metadata Must Stay Infrastructure-Only

Upload metadata should describe storage and source file details only.

Actual memory state should be derived after replay loads.

## Inference Is Placeholder

`app/api/infer/route.ts` currently returns placeholder signal data. Do not wire it into upload.

Inference should evolve as a replay-time or post-replay layer.

## Vision Helpers Are Early Stubs

Files under `lib/vision/*` are not yet a complete production analysis pipeline.

Do not treat them as upload dependencies.

## Mux Upload Route Is Parallel/Legacy

`app/api/mux/upload/[id]/route.ts` creates sessions from Mux upload polling. It is separate from the Supabase Storage upload route.

Changes here should preserve replay normalization and old session compatibility.

## Old Sessions May Be Sparse

Older `axis_sessions` rows or local storage sessions may lack:

- `metadata`
- `tags`
- `file_path`
- `duration_seconds`
- `memoryState`
- timeline fields

Always normalize before render.

## Signed URLs Expire

Signed URLs are temporary. `file_path` is the durable reference.

Replay recovery should refresh signed URLs when possible.

## UI Language Drift

Future agents may introduce generic analytics labels or dramatic signal labels. Do not use:

- CONTROL LOST
- PRESSURE SPIKE
- RUN DETECTED
- RECOVERY WINDOW

Use AXIS memory language instead.
