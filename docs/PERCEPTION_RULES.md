# Perception Rules

Axis observes before it interprets.

## Observable Truths

Axis may claim only what the system can measure:

- memory stored
- replay ready
- warmup added
- duration
- activity windows
- cadence estimate
- rep segments
- movement bursts
- brightness changes
- camera movement
- audio energy when available
- landmark persistence when confidence supports it

## Forbidden Claims

Do not claim:

- skill grades
- basketball IQ
- fatigue
- pressure
- toughness
- shot quality
- decision quality
- coaching judgment
- made or missed shots
- defense quality
- player detection unless implemented with evidence
- court detection unless implemented with evidence

## Confidence Gates

Measured reads must be confidence-gated.

If confidence is not high enough, keep reward-first language:

- Memory stored. Read still building.
- Replay ready.
- Reads improve after more warmups.

Do not make a failed read feel like a failed upload.

## Survivability

Replay always survives.

If frame sampling, audio, segmentation, or MediaPipe fails:

- upload still succeeds
- replay still renders
- memory stays stored
- warmup progression can still advance
- reads degrade quietly

Perception is enhancement, not infrastructure.
