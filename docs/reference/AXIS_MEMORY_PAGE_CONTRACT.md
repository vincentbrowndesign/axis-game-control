Status: REFERENCE

Why moved: memory-page content is merged into the active session memory capsule.

Current replacement source: `docs/capsules/AXIS_SESSION_MEMORY.md`

---

# Axis Memory Page Contract

## Purpose

This document defines the future Axis Memory Page: the user-facing page created from saved Axis Session Objects.

Axis Memory Pages are the product payoff.

Core rule:

> A session is valuable when it becomes memory the user can search, review, correct, and build from.

This document is documentation only.

It does not change runtime behavior.
It does not change UI.
It does not add features.

## Product Context

Axis is a basketball session memory system.

The capture screen is the door.
The Memory Page is the thing the user returns to.

Axis wins when the user opens tomorrow because yesterday's memory made today's plan easier.

## Axis Memory Page

An Axis Memory Page is a user-facing summary and review surface generated from one saved session.

It organizes:

- Session context
- Player(s)
- Focus / objective
- Meaningful moments
- Corrections
- Evidence references
- Review needs
- Searchable text
- Next session carryover

## Required A1 Fields

```ts
export type AxisMemoryPage = {
  id: string
  sessionId: string
  createdAt: string
  updatedAt: string

  title: string
  sessionType: string
  players: string[]
  objective: string
  startedAt: string
  endedAt?: string
  durationSeconds?: number

  summary: string
  whatHappened: string[]
  corrections: string[]
  carryover: string[]
  nextSessionCard: AxisNextSessionCard

  sessionObjectIds: string[]
  evidenceRefs: string[]
  needsReviewCount: number

  searchableText: string
  correctionHistory: AxisMemoryPageCorrection[]
}

export type AxisNextSessionCard = {
  title: string
  focus: string
  reminders: string[]
  unresolvedQuestions: string[]
}

export type AxisMemoryPageCorrection = {
  correctedAt: string
  field: string
  previousValue: unknown
  nextValue: unknown
  reason?: string
}
```

## Page Sections

A1 Memory Page sections should be simple:

1. Session Summary
2. What Happened
3. Corrections
4. Evidence / Signals
5. Needs Review
6. Next Session Card

The page should not become a dashboard.

## What It Owns

An Axis Memory Page owns:

- The human-readable session memory
- Links to Axis Session Objects
- Searchable session summary text
- Review/correction state
- The next session carryover card

## What It Does Not Own

An Axis Memory Page does not own:

- Raw video processing
- Raw detections
- Model internals
- Verified evidence verdicts
- Cross-player truth
- Long-term player profile truth
- Payment, sponsor, or report workflows

## Search Behavior

Memory Pages should support questions like:

- What did Hailey work on last time?
- What corrections repeated?
- What should we do next session?
- What did we mark as needs review?
- What moments have evidence?
- What did we say about finishing?

## Review Behavior

The Memory Page should make correction easy.

Correction examples:

- Wrong player
- Wrong cause
- Wrong outcome
- Missing context
- AI overclaimed
- Evidence does not support the interpretation

Corrections should update:

- The Memory Page
- The related Axis Session Objects
- `searchableText`
- `correctionHistory`

## Next Session Card

The Next Session Card is the retention object.

It should answer:

- What should we remember?
- What should we continue?
- What should we correct?
- What should we test next?

Example:

```txt
Next Session Card

Focus:
Pound stop pivot finish

Reminders:
- Keep base wider on the stop
- Look to score earlier off the dribble
- Review one clip before starting

Unresolved:
- Is the hesitation a confidence issue or timing issue?
```

## User-Facing Rules

Show:

- Session title
- Player(s)
- Focus
- Summary
- Corrections
- Needs Review
- Next Session Card
- Search / Ask Axis

Hide:

- APIs
- Raw detections
- Raw track IDs
- FPS
- Frame counts
- JSON
- Model names
- Debug tools

## Acceptance

This contract is accepted when it defines:

- What a Memory Page is
- What fields it needs
- How it relates to Session Objects
- What review/correction means
- What search should support
- Why the Next Session Card matters
