# Axis Basketball AI Tagging Plan

## Goal

Define how Axis AI tags basketball events using overlay context.

There are no manual tags first. The AI creates event candidates. The coach reviews AI output after candidates exist.

## Core Rule

AI should not tag basketball events from raw video alone.

AI receives structured context:

- recording frames
- overlay config
- court zone map
- detection output
- pose output later
- session context

The overlay creates the court context. Detection and pose add visual evidence. AI uses those inputs to create event candidates that can be reviewed.

## AI Inputs

### Recording Frames

Sampled video frames with:

- `recording_id`
- frame number
- timestamp
- image path
- width
- height

### Overlay Config

Saved overlay configuration with:

- `overlay_type`
- opacity
- transform
- calibration
- settings

### Court Zone Map

Calibrated basketball zones derived from the overlay:

- rim area
- paint
- elbows
- slots
- corners
- wings
- dunker spots
- top
- shot chart zones
- Delta Offense role points
- spacing shape points

### Detection Output

Later detection output may include:

- players
- ball
- hoop/rim candidates
- frame quality
- object confidence

### Pose Output Later

Pose output can be added later for:

- body orientation
- closeout posture
- drive posture
- finish extension
- shot release shape
- defensive stance

### Session Context

Session context should include:

- `session_id`
- session type
- title
- location when available
- active overlay type
- recording metadata

## Candidate Event Types

AI should output candidates for:

- `possible_shot`
- `possible_make`
- `possible_miss`
- `paint_touch`
- `corner_touch`
- `elbow_touch`
- `slot_touch`
- `top_touch`
- `spacing_good`
- `spacing_bad`
- `drive`
- `kickout`
- `extra_pass`
- `turnover`
- `closeout`
- `rebound`
- `finish`
- `Delta top/get action`
- `Delta elbow action`
- `Delta corner DHO action`
- `horns shape`
- `triangle shape`
- `5-out shape`

These are candidates, not final truth.

## Candidate Fields

Each candidate needs:

- `event_type`
- `start_time_seconds`
- `end_time_seconds`
- `confidence`
- `reason`
- `overlay_context`
- `evidence`
- `metadata`

## Evidence Requirements

Each candidate should point back to evidence:

- recording id
- frame ids or frame numbers
- timestamps
- court zones involved
- overlay config id
- detection ids when available later
- pose ids when available later
- short reason written for coach review

Example:

```json
{
  "event_type": "paint_touch",
  "start_time_seconds": 12.4,
  "end_time_seconds": 13.8,
  "confidence": 0.72,
  "reason": "Ball-handler enters calibrated paint zone before the kickout.",
  "overlay_context": {
    "overlay_type": "court-zones",
    "zones": ["paint", "slot"]
  },
  "evidence": {
    "frames": [12, 13, 14],
    "timestamps": [12.0, 13.0, 14.0]
  },
  "metadata": {
    "source": "overlay-aware-ai-tagging"
  }
}
```

## Coach Role

Coach reviews AI output.

Coach does not manually tag first.

The coach can approve, reject, or correct AI-created candidates later. That review creates trusted basketball memory. Manual input is review and correction, not the first tagging layer.

## Storage

Store AI output in:

```text
basketball_ai_event_candidates
```

Mapping:

- `event_type` -> candidate label
- `start_time_seconds` -> start timestamp
- `end_time_seconds` -> end timestamp
- `confidence` -> model confidence or combined confidence
- `reason` -> short explanation
- `overlay_context` -> overlay config, zone map, and zone evidence
- `detections` -> detection and pose evidence when available
- `metadata` -> model version, frame ids, prompt version, worker version

## Not In This Step

Do not build manual tagging UI.

Do not build final stat truth.

Do not build shot-result certainty.

Do not skip coach review.
