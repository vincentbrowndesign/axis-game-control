# Axis Toolbar Contract

Status: contract only

The Axis Toolbar is a context-aware command layer for the current routine state.

It is not a generic chatbot, a random open prompt box, a replacement for manual controls, or a tool that can mutate data without user approval.

It is a scoped command surface. It knows the current page state, selected field, selected block, run state, report state, or review target. It can suggest structured changes, explain warnings, and prepare a patch, but the user reviews the change before it applies.

## Modes

### Setup Mode

- build routine
- edit routine
- balance block times
- change difficulty
- change scoring method
- explain setup warnings

### Ready Mode

- review plan
- suggest changes before starting
- prepare start

### Run Mode

- push the user to the next block
- explain current block
- give simple coaching cue
- keep workout moving

### Log Mode

- help capture reps fast
- protect against slow or cluttered input
- later support voice and manual logging

### Report Mode

- explain what happened
- summarize performance
- recommend next session

### Review Mode

- coach reviews AI output
- accept, ignore, or correct suggestions
- add coach notes

### Vision Mode

Future only.

- attach video to RoutineRun
- align video timestamp to RepEvent
- review uncertain detections
- approve or reject vision events

## Command Flow

1. User gives input or taps a toolbar action.
2. Axis reads current context.
3. Axis creates a proposed patch or recommendation.
4. User sees the proposed change.
5. User chooses Apply, Ignore, or Edit.
6. Only Apply mutates routine state.

## Required Data Concepts

- `AxisToolbarMode`
- `AxisToolbarContext`
- `AxisToolbarTarget`
- `AxisCommand`
- `AxisSuggestion`
- `AxisPatch`
- `AxisReviewDecision`

## AI Boundary

- AI cannot invent numbers.
- AI cannot overwrite calculated results.
- AI cannot directly mutate routine state.
- AI must stay inside the current routine context.
- AI returns suggestions, explanations, or patches.
- User approval is required before changes apply.

## Manual Hybrid Rule

Manual controls always work without AI.

Axis can guide, suggest, and explain. The coach or user remains the final reviewer.

## Surface Rule

Do not show a fake Ask Axis input.

Do not show disabled future buttons.

Only add visible toolbar UI when it performs real local actions inside the current routine state.
