# Axis Basketball Final Sweep Report

Sweep date: 2026-06-29

## Current MVP

Axis Basketball is body-first:

- start body session
- choose front or rear camera
- open camera
- detect one body
- draw pose landmarks
- show simple body reads
- save body context locally for future AI

## Removed From MVP

- court overlay UI
- tactical overlay modes
- manual tagging
- fake AI event review
- clip-first workflow
- basketball data lookup as first-screen product

## Kept

- `src/components/AxisBodyTracker.tsx`
- root `/` body tracker
- `/axis/basketball` body-first status board
- local body context storage
- body-first docs
- body-first cleanup migration

## Known Limitations

- body context is localStorage only
- persistent storage is not wired
- recording is not wired
- AI body reads are not built
- camera quality depends on light and full-body framing

## Next Safe Step

- add authenticated body session and pose sample persistence.
