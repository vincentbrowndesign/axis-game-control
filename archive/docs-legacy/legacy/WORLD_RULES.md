# World Rules

## Layer Rules

Uploads are infrastructure.

Digital Twin, warmups, memory continuity, signals, segmentation, MediaPipe, and reads happen after upload.

Do not couple:

- upload to inference
- upload to memory narration
- upload to warmup chain progression
- replay schema to Digital Twin storage

## Continuity Rules

- Missing player identity must not make the product feel broken.
- Use `LOCAL PLAYER` when no Digital Twin exists.
- Warmup progress is keyed by `twinId + warmupId`.
- Global memory count remains separate.
- Replay pages need forward actions after reward.

## Product Rules

Lead with:

- MEMORY STORED
- REPLAY READY
- WARMUP ADDED
- ARCHIVE ACTIVE

Then show:

- read building
- warmup progress
- comparison unlock status

Do not make failed perception the dominant product state.
