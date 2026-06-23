Status: REFERENCE

Why moved: product-council logic is useful background but not the active source-of-truth entry point.

Current replacement source: `docs/AXIS_PRODUCT_MAP.md`

---

# Axis Product Council

## Purpose

Axis is a session memory product, not a raw AI demo. Every feature must pass through the product council before it becomes user-facing.

Core product sentence:

> Axis turns basketball sessions into searchable memory you can review, correct, and build from.

## Council Roles

### 1. Basketball Expert

Purpose:
Protect basketball truth.

Owns:

- What matters in practice, games, training, shooting, scrimmage, and film
- Basketball language
- Session context
- Useful teaching structures
- What is fake or misleading

Rejects:

- Vague labels like `GOOD_READ` / `BAD_READ` as core data
- Fake stats
- AI claims that do not match basketball reality

Prefers:

- Situation -> actor -> action -> outcome -> cause -> correction -> evidence

### 2. Product Designer

Purpose:
Protect convenience and clarity.

Owns:

- First screen
- Live session flow
- Tools hierarchy
- Mobile usability
- Friction reduction
- What stays hidden

Rejects:

- Rim, zones, or debug controls on landing
- Crowded button rows
- Technical words in normal UI
- Setup-heavy flows

Prefers:

- Start Session
- Talk naturally
- Mark moments
- End
- Saved to Memory

### 3. Tech Guru

Purpose:
Protect feasibility, reliability, and architecture.

Owns:

- APIs
- Routers
- Camera and mic behavior
- Persistence
- Performance
- Safe boot
- Error handling

Rejects:

- Fragile auto-start behavior
- Features that crash mobile
- Unvalidated `localStorage`
- Duplicate loops
- Exposed implementation details

Prefers:

- Capabilities hidden behind simple user actions
- Typed or tap fallback when mic, camera, or AI fails
- Safe, testable increments

### 4. Data Architect

Purpose:
Protect memory quality.

Owns:

- Axis Signals
- Axis Session Objects
- Axis Memory Pages
- `searchableText`
- `correctionHistory`
- Dataset examples

Rejects:

- Loose notes with no structure
- Unsearchable exports
- Random event names
- Data that cannot become memory or training material

Prefers:

- Every meaningful moment becomes structured memory

### 5. AI / ML Lead

Purpose:
Protect truthfulness and future learning.

Owns:

- Classification confidence
- `needsReview` states
- Correction learning
- Model boundaries
- Dataset readiness

Rejects:

- Fake certainty
- Pretending vision is reliable when it is not
- Treating silence as a miss without shot-attempt evidence
- Broad buckets that teach nothing

Prefers:

- High confidence = log
- Medium confidence = needs review
- Low confidence = note / uncategorized
- Corrections improve future routing

### 6. Marketing Genius

Purpose:
Protect commercial clarity.

Owns:

- Positioning
- Buyer pain
- Offer
- Demo
- Pricing path
- Language customers understand

Rejects:

- Esoteric product descriptions
- Selling routers, APIs, or datasets first
- Feature lists without pain or outcome
- AI jargon as the main pitch

Prefers:

- "Stop losing what happened."
- "Record it. Talk through it. Axis remembers it."
- "Every session becomes searchable basketball memory."

### 7. Customer / Operator Expert

Purpose:
Protect real-world use.

Owns:

- Practice, gym, and game conditions
- Bad Wi-Fi
- Phone use
- Parent and operator usability
- Time pressure
- One-hand operation

Rejects:

- Workflows that require a coach to babysit the app
- Too many taps before starting
- Features that only work in perfect conditions

Prefers:

- Works with typed input
- Works with tap input
- Works with voice
- Works with camera when available
- Starts fast
- Produces a useful end summary

## Decision Checklist

Before building any feature, answer:

1. Does this help Axis turn a session into searchable memory?
2. Does this reduce friction or increase it?
3. Does the user need to see this, or should it live in Tools / Axis Lab?
4. Does this create structured data?
5. Can it work if camera, mic, or AI fails?
6. Can a coach use it during a real session?
7. Does it make the next session easier?
8. Does it help us sell the product?
9. Is it honest about confidence?
10. Does it support practice, game, training, shooting, scrimmage, or film?

## User-Facing Rules

Show by default:

- Start Session
- Session type
- Focus
- Timer
- Natural input
- Last interpreted moment
- Correction controls
- Summary
- Saved to Memory
- Search / Ask Axis

Hide by default:

- APIs
- Routers
- Model names
- Raw detections
- Raw track IDs
- Confidence percentages
- FPS
- Frame count
- JSON
- Calibration objects
- Rim setup on landing
- Zones on landing
- Debug tools

## Corrected Decision Examples

Bad:
Show rim setup on landing.

Correct:
Hide Hoop Setup inside Tools. Only surface it when the session type requires shot truth.

Bad:
Use `GOOD_READ` as a main bucket.

Correct:
Structure the moment as situation -> actor -> action -> outcome -> cause -> evidence.

Bad:
Build video tracking first.

Correct:
Build session memory first. Video becomes evidence when available.

Bad:
Sell Axis as AI basketball routers.

Correct:
Sell Axis as session memory: every practice, game, and workout becomes searchable memory.
