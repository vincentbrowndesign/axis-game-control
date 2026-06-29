# Axis Basketball Frame Extraction Plan

## Goal

Turn each recorded camera session into sampled frames plus overlay context.

Axis should not analyze raw video alone. AI should analyze:

```text
video frame + timestamp + overlay context + court zone map
```

The overlay calibration is what turns pixels into basketball context. Frame extraction must carry that context forward so later AI analysis can reason about court zones, spacing, and action location.

## Input

- `recording_id`
- video file path or blob
- `overlay_config_id`
- sample rate

## Output

- frames
- timestamps
- overlay config
- calibrated court zones
- frame metadata

## Frame Extraction Flow

1. Load the recording by `recording_id`.
2. Load the active overlay config by `overlay_config_id`.
3. Resolve the recording source:
   - local blob for MVP/manual local testing
   - stored video path later
4. Read video metadata:
   - width
   - height
   - duration
   - fps when available
5. Sample frames at the requested rate.
6. Save each frame image.
7. Attach timestamp and overlay context to each frame.
8. Generate calibrated court zone metadata for each frame.
9. Return frame records for later AI detection and event reasoning.

## Future Worker

Future worker path:

```text
python/basketball/extract_frames.py
```

The worker should accept:

```text
recording_id
video_path
overlay_config_id
sample_rate
```

The worker should return a frame manifest that can be saved to Postgres and passed to later AI workers.

## Frame Record Fields

Each extracted frame should include:

- `recording_id`
- `frame_number`
- `timestamp_seconds`
- `image_path`
- `overlay_context`
- `width`
- `height`

## Overlay Context

Overlay context should include:

- `overlay_type`
- opacity
- transform
- calibration
- settings
- court-side preset
- corner pins
- calibrated court zone map

The calibrated court zone map should describe where basketball zones are located in the frame after applying the saved overlay transform.

Examples:

- rim area
- paint
- elbows
- slots
- wings
- corners
- dunker spots
- top
- shot chart zones
- spacing shape points
- Delta Offense role locations

## Sampling Guidance

The first practical sample rate should be conservative:

- 1 frame per second for broad review
- 2 frames per second for short possessions
- 4 frames per second for dense action experiments later

Do not over-sample before the storage and worker path is stable.

## Later AI Contract

Later AI analysis should receive:

- frame image
- timestamp
- recording metadata
- overlay config
- calibrated court zones
- prior frame context when available

AI outputs should reference the frame and timestamp that produced the read. Tags should come from AI after frame extraction and overlay context exist.

## Not In This Step

Do not build tagging UI.

Do not build manual events.

Do not build AI analysis yet.

Do not infer basketball truth from raw frames without overlay context.
