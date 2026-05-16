# Memory Model

Axis memory has separate counters.

## Global Memory Count

Global memory count is the total archive size.

Example:

`Global archive: 21 memories`

This number must not drive warmup comparison unlocks.

## Warmup Chain Count

Warmup chain count is scoped to one Digital Twin and one warmup.

Chain key:

`twinId + warmupId`

Example:

`LOCAL PLAYER + HANDLE = 2 / 3 warmups`

## Continuity

One replay is a stored memory.

One warmup chain is a repeated behavioral lane.

Replay storage can succeed even when reads are still building. Warmup progression should still advance once the memory exists.

## Default Twin

If no profile exists, Axis uses `LOCAL PLAYER` so continuity does not break.

Authenticated users should create a Digital Twin for durable identity.
