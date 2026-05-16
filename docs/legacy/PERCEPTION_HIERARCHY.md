# Perception Hierarchy

Axis perception advances in layers.

## 1. Storage

Memory exists. Replay is ready.

This is always the first reward.

## 2. Browser Signals

Browser-safe measurements:

- duration
- brightness
- motion estimate
- camera movement
- audio energy when available

## 3. Segmentation

Replay is divided into behavioral units:

- activity windows
- pauses
- resets
- rep segments
- rhythm clusters
- movement bursts

## 4. Landmarks

MediaPipe may observe geometry:

- landmark persistence
- wrist rhythm
- shoulder stability
- stance width
- lateral movement
- upper-body rhythm

## 5. Comparison

Comparison unlocks only after enough warmups exist for the same `twinId + warmupId`.

Compare observable values only.

## Failure Rule

If any perception layer fails, replay remains valuable:

`Memory stored. Read still building.`
