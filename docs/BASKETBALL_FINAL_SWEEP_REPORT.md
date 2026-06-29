# Axis Basketball Final Sweep Report

Sweep date: 2026-06-29

## Current MVP

Axis Basketball is full-body-first:

- start full body session
- choose front or rear camera
- open camera
- check full body visibility
- detect one full body
- draw full-body pose landmarks
- show simple full-body reads only when the gate passes
- save full-body context locally for future AI

## Removed From MVP

- court overlay UI
- tactical overlay modes
- manual tagging
- fake AI event review
- clip-first workflow
- basketball data lookup as first-screen product

## Kept

- `src/components/AxisFullBodyTracker.tsx`
- root `/` full body tracker
- `/axis/basketball` full-body status board
- local full-body context storage
- full-body-first docs
- body-first cleanup migration

## Known Limitations

- full-body context is localStorage only
- persistent storage is not wired
- recording is not wired
- AI body reads are not built
- camera quality depends on light and full-body framing

## Next Safe Step

- add authenticated body session and pose sample persistence.
