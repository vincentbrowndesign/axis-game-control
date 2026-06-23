Status: REFERENCE

Why moved: build-order content is merged into the active session memory capsule and build map.

Current replacement source: `docs/capsules/AXIS_SESSION_MEMORY.md` and `docs/AXIS_BUILD_MAP.md`

---

# Axis A1 Build Sequence

## Purpose

This document defines the build order for Axis A1.

Axis A1 must prove session memory before advanced AI or tracking features become product-critical.

Core rule:

> Build the memory loop first. Make AI and vision help the loop, not define it.

This document is documentation only.

It does not change runtime behavior.
It does not change UI.
It does not add features.

## Product Frame

Axis is a basketball session memory system.

A1 loop:

Start Session
-> talk / type / tap what happened
-> Axis structures it
-> end session
-> saved to memory
-> summary + next session card

The capture screen is not the product.
The real product is the memory system behind it.

## A1 Build Principles

1. Typed and tap input must work before AI is required.
2. Camera and voice are accelerators, not dependencies.
3. Every meaningful moment should become structured memory.
4. Every saved session should produce a useful end summary.
5. Every summary should create a next session card.
6. Debug tools live behind Axis Lab.
7. User-facing language must avoid model/provider/debug terms.
8. All confidence must be honest.

## Build Sequence

### Step 1: Start Session Contract

Goal:
Create the durable session shell.

Must include:

- Session type
- Player(s)
- Focus / objective
- Start time
- End time
- Manual events
- Source inputs

Acceptance:

- User can start a session without camera or AI
- User can end a session
- Session context is available to every later object

### Step 2: Manual Event Capture

Goal:
Make practice usable immediately.

Must include:

- Good Rep
- Again
- Note
- Snapshot when available
- End Session

Acceptance:

- User can log useful session moments with taps and typed notes
- Events include timestamp, elapsed time, player(s), focus, and session type

### Step 3: Axis Session Object Creation

Goal:
Convert manual and natural inputs into structured memory.

Must include:

- Situation
- Actor
- Action
- Outcome
- Cause
- Correction
- Evidence references
- Confidence
- Needs review
- Searchable text

Acceptance:

- A note like "feet too narrow" becomes a structured object
- `GOOD_REP` remains a signal unless context makes it meaningful

### Step 4: End Session Summary

Goal:
Turn session objects into a useful session closeout.

Must include:

- Session summary
- What happened
- Corrections
- Counts
- Needs review
- Export session data

Acceptance:

- User can understand the session in under 10 seconds
- Summary works even if camera, mic, or AI failed

### Step 5: Save To Memory

Goal:
Persist the session and its structured objects.

Must include:

- Exact session shell
- Axis Session Objects
- Manual events
- Searchable text
- Correction history

Acceptance:

- User can reopen the session
- Session memory is searchable
- Saved state is clear

### Step 6: Memory Page

Goal:
Create the returnable product surface.

Must include:

- Session Summary
- What Happened
- Corrections
- Evidence / Signals
- Needs Review
- Next Session Card

Acceptance:

- User can review, correct, and search the session
- User can see what to do next

### Step 7: Search / Ask Axis

Goal:
Let users retrieve session memory naturally.

Must support:

- Player queries
- Focus queries
- Correction queries
- Carryover queries
- Evidence queries

Acceptance:

- User can ask what happened last session
- User can ask what to work on next
- Search uses structured memory, not raw export text only

### Step 8: Voice Input

Goal:
Reduce friction during live use.

Rules:

- Voice creates transcript source input
- Transcript is structured into Session Objects
- Typed/tap fallback remains available

Acceptance:

- Voice improves speed but is not required

### Step 9: Camera / Vision As Evidence

Goal:
Let camera and AI support memory when available.

Rules:

- Vision signals are not automatic truth
- Vision can create suggested observations
- Suggested observations may require review
- Camera failure cannot break the session

Acceptance:

- Vision helps evidence and review
- Axis remains useful without vision

### Step 10: Correction Learning

Goal:
Use corrections to improve future structure.

Must include:

- Correction history
- Review state
- Updated searchable text
- Dataset examples when appropriate

Acceptance:

- User corrections improve future routing and memory quality

## Do Not Build Before A1 Memory Works

Do not prioritize:

- Shot detection
- Pass detection
- Defense reads
- Fake automatic stats
- Full player model
- Sponsor tools
- Marketplace
- Reports as the main product
- Debug dashboards

These can come later only if they strengthen session memory.

## A1 Acceptance Test

A1 passes when:

1. User starts a session
2. User logs typed/tap moments
3. Axis structures the moments
4. User ends the session
5. Axis creates a summary
6. Axis creates a next session card
7. Session is saved to memory
8. User can search or ask about it later
9. The loop works even if camera, mic, and AI fail

## Product Council Gate

Before any build step moves forward, ask:

1. Does it help Axis turn a session into searchable memory?
2. Does it reduce friction?
3. Does it create structured data?
4. Can it work without camera, mic, or AI?
5. Can a coach use it during a real session?
6. Does it make the next session easier?
7. Is it honest about confidence?

If the answer is no, the feature belongs later, behind Tools, or in Axis Lab.
