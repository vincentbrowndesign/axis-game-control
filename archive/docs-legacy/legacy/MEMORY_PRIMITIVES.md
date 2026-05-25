# Memory Primitives

## Memory

A stored replay session. Memory begins when the upload contract succeeds and a replay exists.

## Warmup Chain

A progression lane for one player and one warmup type.

Chain key:

`twinId + warmupId`

Example:

`LOCAL PLAYER + WARMUP 01 HANDLE = 2 / 3 warmups`

## Activity Window

A span of time where measured motion stays active long enough to be stored as a readable event.

## Cadence

An estimated rhythm interval derived from repeated motion or audio peaks.

## Rep Segment

A rep-like segment detected from repeated motion cycles. It is not a skill judgment.

## Rhythm Cluster

A group of repeated events that share a similar timing pattern.

## Pause

A low-activity gap between activity windows or rep-like segments.

## Reset

A pause that appears between repeated movement attempts. Axis may store it as structure, not as coaching.

## Movement Burst

A short span of elevated motion intensity.

## Landmark Persistence

How consistently pose landmarks remain visible across sampled frames.

## Comparison Unlock

Comparison becomes available after enough memories exist for the same player and warmup type.

Default unlock:

`3 warmups`

Before unlock, Axis may show progress only. After unlock, Axis may compare observable values only.
