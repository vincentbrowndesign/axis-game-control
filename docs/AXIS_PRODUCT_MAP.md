# Axis Product Map

Status: ACTIVE

Purpose: Define what Axis is, who it is for, and how future work should be judged.

## Core Sentence

Axis is a basketball session memory system.

Expanded:

Axis captures any basketball session, turns what happened into structured memory, and helps the user search, review, correct, export, and build from it.

## Product Loop

```text
Start Session
-> talk / type / tap what happened
-> Axis structures it
-> end session
-> saved to memory
-> summary + next session card
```

## Product Rule

The capture screen is not the product.

The real product is the memory system behind it.

## Who Axis Serves

- coaches who need to stop losing what happened
- players who need to know what they are working on next
- parents who need understandable proof of development
- trainers and programs who need sessions to become reusable assets

## What Axis Captures

Axis can capture:

- typed notes
- tap events
- voice transcripts when available
- manual corrections
- video or camera evidence when available
- AI signals when available

Typed and tap input must still create memory when camera, mic, AI, or internet fail.

## How Reality Becomes Memory

Axis should prefer this structure:

```text
Situation
-> Actor
-> Action
-> Outcome
-> Cause
-> Correction
-> Evidence
```

Manual labels such as `GOOD_REP`, `AGAIN`, and `NOTE` are signals. They become durable memory only when tied to session context.

## Value Timing

Axis creates value:

- before a session by showing carryover
- during a session by capturing moments with low friction
- after a session by creating memory
- before the next session by producing a next session card

## Main Decision Test

Before building anything, ask:

1. Does this help Axis turn a basketball session into searchable memory?
2. Does this reduce friction during real use?
3. Can it still work if camera, mic, or AI fails?
4. Does it create structured data the user can review or correct?
5. Does it make the next session easier?
6. Is it honest about confidence?
7. Does it belong on the main screen, in Tools, in Axis Lab, or in future work?

## Do Not Use As Core Product Language

Avoid making the product about:

- routers
- providers
- raw detections
- model names
- JSON
- dashboards
- fake stats
- technical pipelines

## Source Merge Note

This active product map replaces the active-source role previously held by `docs/AXIS_5W1H_PRODUCT_MAP.md`.

The full 5W1H version is preserved in `docs/reference/AXIS_5W1H_PRODUCT_MAP.md`.
