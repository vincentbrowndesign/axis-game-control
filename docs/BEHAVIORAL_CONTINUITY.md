# Behavioral Continuity

Behavioral continuity is the reason Axis exists.

## Digital Twin Anchor

The Digital Twin anchors the player's behavioral memory.

It connects memories across:

- warmups
- replays
- sessions
- baselines
- future comparisons

## Warmup Chains

Warmup chains track repeated behavioral context.

The key is:

`twinId + warmupId`

Never use global memory count as a warmup chain counter.

## Replay Continuity

Replay is memory retrieval. It should never dead-end.

After replay, provide:

- NEXT WARMUP
- RETURN TO MEMORY CORE
- VIEW WARMUP CHAIN

## Missing Identity

Missing profile data must not break continuity.

Use `LOCAL PLAYER` as a default twin until the authenticated user creates a Digital Twin.
