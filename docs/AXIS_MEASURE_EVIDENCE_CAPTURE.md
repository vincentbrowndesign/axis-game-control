# Axis Measure Evidence Capture v0

Status: ACTIVE LAB REFERENCE

Axis Measure evidence capture turns live vision testing into Axis-owned training data.

Current product truth:

```text
Axis Measure is a Player + Ball + Rim lock system.
```

It is not a full basketball analytics product yet. Evidence capture should improve object lock quality, not create game stats or dashboards.

## Why This Exists

Live camera testing produces the most useful examples because it reflects real Axis conditions:

- gym lighting
- phone and iPad camera angles
- player clothing
- ball blur and occlusion
- rim visibility
- floor and wall reflections

When a tester saves a frame in Debug mode, Axis keeps the image plus the current player, ball, and rim boxes. Those saved frames become review material for future detector and overlay improvements.

## Capture Flow

```text
Open /vision
-> switch to Debug
-> Save Test Frame
-> add quick quality labels
-> review saved frames
-> accept, reject, delete, or export JSON
```

Product mode stays clean. Save and review controls belong in Debug/Measure workflow only.

## Stored Frame Shape

Each saved frame stores:

- id
- createdAt
- imageDataUrl
- frameWidth
- frameHeight
- objects
- relationships
- qualityLabels
- notes optional
- detectorLatencyMs
- surface: axis | measure
- route
- timestamp
- reviewStatus

Storage is local first through browser localStorage. No database is required in v0.

## Quality Labels

The first labels are:

- good_player_lock
- bad_player_lock
- false_player
- missed_player
- good_ball_lock
- missed_ball
- good_rim_anchor
- bad_rim_anchor

These labels are intentionally simple. They help separate good evidence from noisy frames without turning the tool into a dashboard.

## Training Data Value

Accepted and rejected boxes become future dataset material.

Examples:

- `good_player_lock` confirms useful player boxes.
- `false_player` identifies reflections, posters, background people, and edge artifacts.
- `missed_player` catches frames where YOLO or filtering failed.
- `good_ball_lock` and `missed_ball` sharpen ball visibility tests.
- `good_rim_anchor` and `bad_rim_anchor` capture manual rim placement quality.

## Rim Truth

Rim anchors are manual labels in v0.

Axis should not pretend rim detection exists before it does. Manual rim locks are useful training and evaluation data because they show where real users place the rim box in real sessions.

## Review Route

The review route is:

```text
/measure/review
```

It shows saved frames as cards with:

- image preview
- object count
- labels
- created time
- accept
- reject
- delete
- Export JSON

## Long-Term Direction

Evidence capture is the bridge from live testing to better Axis Measure:

```text
live camera
-> saved test frame
-> accepted/rejected boxes
-> reviewed training examples
-> better player/ball/rim lock
```

Public datasets help Axis Measure see. Axis-owned evidence helps it work in real Axis sessions.
