# Axis Routine Loop

Status: CONTRACT

Core product sentence:
Axis turns a training session into a repeatable benchmark, rep timeline, and workout report.

## Active Loop

Axis Routine Loop

```text
Setup routine
-> run blocks
-> log reps
-> calculate metrics
-> produce Workout Report
-> review next session recommendation
```

## Market Deliverable

Workout Report

A Workout Report is the user-facing value. It is a clear training summary that a player, parent, coach, trainer, or program would want to keep, review, share, or act on.

The report is not JSON. It is not an artifact. It is not an export. It is the readable result of the session.

## User

- player
- parent
- coach
- trainer
- program

## Hidden Dataset

The loop creates or updates internal routine records:

- routine template
- routine run
- routine blocks
- rep events
- metrics snapshots
- workout report
- optional insight
- optional evidence attachment later
- optional vision event later

These records stay hidden from the surface unless they become part of the report.

## Proof It Is Real

The loop is real when:

1. A routine has a player or group, focus, length, scoring method, benchmark, and blocks.
2. A run starts and ends.
3. Reps are logged against blocks.
4. Metrics are calculated deterministically.
5. A Workout Report exists without requiring AI, video, camera, or internet.

## What Stays Off The Surface

- raw JSON
- provider names
- model names
- detector output
- confidence scores
- debug panels
- payment UI
- video controls until the vision layer is intentionally added
- any AI insight that overwrites calculated results

## Acceptance Test

1. Setup can define the routine.
2. Running can record reps.
3. Report can show calculated metrics.
4. Calculated report is available even if AI fails.
5. Vision/video can attach later without becoming the foundation.
