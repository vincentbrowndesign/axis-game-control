# Axis UI Agent Instructions

This folder owns the user-facing Axis capture experience.

The UI must remain camera-first and memory-first.

## Default Visible UI

Show only:

- AXIS
- Start Session / End Session
- Camera surface with player box overlay
- Single open command toolbar
- Export control

## Do Not Show By Default

- Mark Moment
- Analyze
- Last Moment
- Correct / Not Right
- test selector
- measurement dashboard
- required landmarks
- optional landmarks
- SDK source
- API source
- model name
- raw detections
- JSON
- FPS
- confidence table
- debug panel
- ball or rim

All debug goes to `/axis/lab`.

## Layout Rule

Camera is the product.

The camera area should dominate the screen.

No page should feel like:

- dashboard
- settings page
- form
- SaaS admin
- biomechanics spreadsheet

## Primary Action

The primary action is typing or tapping anything into the open command toolbar. No submit is empty and no text is invalid - it always resolves to an action, a saved read, a note, or a question.

## Copy Rules

Use short labels.

Good:

- Camera
- Save
- Export
- Flip

Bad:

- AI dashboard
- unlock performance
- training recommendation
- performance score
- full-body tracker
- next action
