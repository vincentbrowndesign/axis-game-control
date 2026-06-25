# Axis Routine UI Standard

Status: CONTRACT

Axis Routine UI should feel like a training tool, not a dashboard or debug console.

Every visible element must be load-bearing.

## Page States

1. Setup
2. Running
3. Report
4. History

## Setup View

Visible controls:

- player/group
- focus
- routine length
- scoring method
- benchmark name
- editable blocks
- start routine

## Running View

Visible controls and signals:

- current block
- total timer
- block timer
- rep controls
- undo
- live score
- Axis Cue

No long-form writing during live training.

## Report View

Visible sections:

- Workout Report
- Today
- Previous
- Change
- Trend
- Next Session
- Copy Report
- New Routine
- Generate Axis Insight only when the AI layer is ready

The calculated report is always available even if AI fails.

## History View

History should show saved Workout Reports and prior routine runs. It should not show raw event JSON or debug data.

## UI Rules

- mobile-first
- one-hand usable
- large tap targets
- no raw JSON
- no debug UI
- no detector UI
- no future vision controls
- no long form during live training
- every visible element must be load-bearing
- calculated report is always available even if AI fails
- save progress after every rep when persistence is added

## Surface Boundary

Do not show:

- provider names
- model names
- detector output
- confidence scores
- relationship data
- measurement frames
- paid UI
- raw schemas
- future video controls before the vision layer is active
