# Warmup System

Warmup is the user-facing ritual.

Calibration is the hidden system layer.

## Product Principle

Axis should feel like:

- getting loose
- starting a session
- building rhythm
- adding a memory to the archive

Axis should not feel like:

- uploading a file
- collecting training data
- running diagnostics
- waiting for a model to succeed

## Flow

The product flow is:

`START MEMORY -> PICK WARMUP -> RECORD WITH AXIS -> MEMORY STORED -> REPLAY INDEXED -> WARMUP ADDED -> READS IMPROVE OVER TIME`

## Store First

Warmup capture always leads with reward:

- MEMORY STORED
- REPLAY READY
- WARMUP ADDED
- ARCHIVE ACTIVE

Reads, segmentation, pose tracking, and comparison happen after the memory exists.

If reads are not ready, say:

- Memory stored. Read still building.
- Reads improve after more warmups.
- 2 more warmups to unlock comparison.

Do not lead with signal failure language.

## Chain Key

Warmup progression is not global memory count.

Warmup progression is keyed by:

`twinId + warmupId`

This means:

- global archive count can be 21
- Local Player can have HANDLE at 2 / 3 warmups
- another warmup can still be 1 / 3

If no player profile exists, Axis silently uses `LOCAL PLAYER` for continuity.

## Discipline

Daily warmups improve the system quietly:

- segmentation cleanliness
- confidence gates
- baseline quality
- comparison quality
- future perception training

The UI must never say that users are collecting training data.
