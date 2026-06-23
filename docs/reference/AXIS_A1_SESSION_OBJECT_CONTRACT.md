Status: REFERENCE

Why moved: contract content is merged into the active session memory capsule.

Current replacement source: `docs/capsules/AXIS_SESSION_MEMORY.md`

---

# Axis A1 Session Object Contract

## Purpose

This document defines the first durable object Axis must create from a basketball session.

Axis A1 is not automatic stat detection. Axis A1 is structured session memory.

Core rule:

> Every meaningful session moment should become a searchable, reviewable, correctable Axis Session Object.

This document is documentation only.

It does not change runtime behavior.
It does not change UI.
It does not add features.

## Product Context

Axis is a basketball session memory system.

The A1 loop is:

Start Session
-> talk / type / tap what happened
-> Axis structures it
-> end session
-> saved to memory
-> summary + next session card

The capture screen is not the product.
The real product is the memory system behind it.

## Axis Session Object

An Axis Session Object is one structured memory unit created from a session.

It may come from:

- Typed input
- Tap input
- Voice transcript
- Coach note
- Player note
- Manual event
- Video timestamp
- AI signal when available

It must not depend on perfect AI vision.

## Required A1 Fields

```ts
export type AxisSessionObject = {
  id: string
  sessionId: string
  createdAt: string
  updatedAt: string

  sessionType:
    | "ball_handling"
    | "shooting"
    | "finishing"
    | "small_sided"
    | "team_practice"
    | "game_film"
    | "axis_lab"
    | "other"

  players: string[]
  actor?: string

  source:
    | "typed"
    | "tap"
    | "voice"
    | "camera"
    | "ai_signal"
    | "manual_event"
    | "imported"

  sourceText?: string
  timestampMs?: number

  situation?: string
  action?: string
  outcome?: string
  cause?: string
  correction?: string
  evidenceRefs: string[]

  tags: string[]
  confidence: "high" | "medium" | "low" | "unknown"
  needsReview: boolean

  searchableText: string
  correctionHistory: AxisSessionObjectCorrection[]
}

export type AxisSessionObjectCorrection = {
  correctedAt: string
  field: string
  previousValue: unknown
  nextValue: unknown
  reason?: string
}
```

## Structured Memory Shape

Axis should prefer:

Situation -> actor -> action -> outcome -> cause -> correction -> evidence

This structure keeps Axis from becoming vague notes.

Examples:

- Situation: advantage created
- Actor: Hailey
- Action: paint touch
- Outcome: extra pass missed
- Cause: late recognition
- Correction: recognize help earlier and pass one count sooner
- Evidence: transcript, timestamp, clip, image, coach note, AI signal

## What A1 Owns

An Axis Session Object owns:

- One meaningful moment
- The structured interpretation of that moment
- The source that created it
- Searchable text
- Review state
- Correction history
- Links to supporting evidence references when available

## What A1 Does Not Own

An Axis Session Object does not own:

- Long-term player truth
- Verified evidence verdicts
- Automatic scouting reports
- Cross-thread memory
- Biometric truth
- Shot detection truth
- Pass detection truth
- Business analytics

Those belong to later layers.

## Event Names

Manual event names may exist, but they are not enough as final memory.

A1 may receive:

- `START_SESSION`
- `GOOD_REP`
- `AGAIN`
- `NOTE`
- `SNAPSHOT`
- `END_SESSION`

These should become structured memory only when there is enough context.

Example:

`GOOD_REP` alone is a signal.

`GOOD_REP + Hailey + Pound Stop Pivot Finish + timestamp` can become a useful session object.

## Confidence Rules

High confidence:

- User stated it directly, or
- User confirmed the structure, or
- Multiple sources support the same interpretation

Medium confidence:

- Axis can infer a likely structure, but user review would improve it

Low confidence:

- Signal exists, but the basketball meaning is unclear

Unknown:

- Raw input has not been structured yet

## Review Rules

Set `needsReview: true` when:

- AI inferred the basketball meaning
- Vision signal is uncertain
- Actor is unclear
- Cause is inferred
- Outcome is ambiguous
- User correction is likely needed

Set `needsReview: false` when:

- User explicitly entered or confirmed the meaning
- The object is a simple factual note
- The object is a manual event with clear context

## Search Rules

`searchableText` should include:

- Player names
- Session type
- Focus / objective
- Situation
- Action
- Outcome
- Cause
- Correction
- Source text
- Tags

Search should help the user ask:

- What happened last time?
- What did we correct?
- What should we work on next?
- What has repeated?
- What evidence supports this?

## Acceptance

This contract is accepted when it defines:

- The smallest A1 memory object
- Required fields
- Source and confidence rules
- Review and correction rules
- Searchable text requirements
- What the object owns
- What it does not own
