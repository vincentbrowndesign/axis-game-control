# Axis Session Memory

Status: ACTIVE

Build Decision: Build Now

Purpose: Define the active A1 memory loop and the smallest durable objects Axis should create from a basketball session.

## Core Rule

Every meaningful session moment should become searchable, reviewable, correctable memory.

## A1 Loop

```text
Start Session
-> talk / type / tap what happened
-> Axis structures it
-> end session
-> saved to memory
-> summary + next session card
```

## Smallest Memory Unit

An Axis Session Object is one structured memory unit created from a session.

It may come from:

- typed input
- tap input
- voice transcript
- coach note
- player note
- manual event
- video timestamp
- AI signal when available

It must not depend on perfect AI vision.

## Preferred Structure

```text
Situation
-> Actor
-> Action
-> Outcome
-> Cause
-> Correction
-> Evidence
```

## A1 Session Object Fields

The active contract should support:

- id
- sessionId
- createdAt
- updatedAt
- sessionType
- players
- actor
- source
- sourceText
- timestampMs
- situation
- action
- outcome
- cause
- correction
- evidenceRefs
- tags
- confidence
- needsReview
- searchableText
- correctionHistory

## Manual Events

A1 may receive:

- `START_SESSION`
- `GOOD_REP`
- `AGAIN`
- `NOTE`
- `SNAPSHOT`
- `END_SESSION`

These are signals. They become structured memory only when enough context exists.

## Memory Page

An Axis Memory Page is the user-facing summary and review surface generated from one saved session.

It should include:

- Session Summary
- What Happened
- Corrections
- Evidence / Signals
- Needs Review
- Next Session Card

## What Session Memory Does Not Own

Session Memory does not own:

- verified evidence verdicts
- automatic scouting reports
- long-term player truth
- cross-thread player memory
- biometric truth
- shot detection truth
- pass detection truth
- sponsor workflows

## Active Build Sequence

1. Start Session Contract
2. Manual Event Capture
3. Axis Session Object Creation
4. End Session Summary
5. Save To Memory
6. Memory Page
7. Search / Ask Axis
8. Voice Input
9. Camera / Vision As Evidence
10. Correction Learning

The first five steps must work without camera, voice, or AI.

## Source Merge Note

This active capsule consolidates:

- `docs/reference/AXIS_A1_SESSION_OBJECT_CONTRACT.md`
- `docs/reference/AXIS_MEMORY_PAGE_CONTRACT.md`
- `docs/reference/AXIS_A1_BUILD_SEQUENCE.md`
