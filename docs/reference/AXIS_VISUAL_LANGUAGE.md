Status: REFERENCE

Why moved: implementation-token reference only; current product design truth lives in the design constitution.

Current replacement source: `docs/AXIS_DESIGN_CONSTITUTION.md`

---

# Axis Visual Language

Status: Active foundation
Build Decision: Build Now

## Product Rule

Axis color is practical harmony, not decoration.

The visual language should help the user understand what is usable, unresolved, corrective, supported, or parked without turning Axis into a dashboard or a new product mode.

## Surface Rule

Cards and sections stay mostly paper/white.

Color should never fill an entire Thread Board section with green, yellow, red, blue, or gray. The board should keep its room, paper, ink, line, and grid foundation first.

## Accent Rule

Color appears as a restrained accent:

- accent stripe
- pill
- dot
- underline
- connector

Color is a helper, not the structure itself.

## Status / Type Boundary

Section type describes what the understanding is:

- Observation
- Pattern
- Relationship
- Question
- Hypothesis
- Intervention
- Outcome

Status describes how the user should currently treat it:

- neutral
- use
- decide
- fix
- proof
- parked

Section type and visual status are separate concepts.

Observation is not automatically proof.
Question is not automatically decide.
Intervention is not automatically use.
Known is not automatically proof.

## Status Resolution

Axis may resolve a local visual status from explicit operational section labels.

This remains client-side presentation logic. It does not add `status` to `ThreadBoardData`, does not change the conversation API, and does not create evidence, confidence, priority, memory, or task tracking.

Operational labels may resolve this way:

- use: GAMEPLAN, TIMEOUT CALL, PLAYER RULE, INSTALL, CORE RULE, NEXT MOVE, ACTION, PLAY
- decide: ASSUMED, READ, WATCH NEXT, NEED NEXT, CHOICE, DECISION
- fix: ADJUSTMENT TRIGGER, FIX, CORRECTION, BREAKING, PROBLEM
- proof: PROOF, EVIDENCE, SIGNALS
- parked: PARKED, HOLD, LATER, NOT NOW
- neutral: everything else

Pure understanding labels stay neutral:

- OBSERVATION
- PATTERN
- RELATIONSHIP
- QUESTION
- HYPOTHESIS
- INTERVENTION
- KNOWN

KNOWN and OBSERVATION must not become proof automatically.

## Status Meanings

neutral:
Context that does not need a special action state.

use:
Ready to apply or act on.

decide:
A choice, judgment, or unresolved direction needs attention.

fix:
A correction is currently required.

proof:
Points toward support or verification work. It does not create evidence or establish truth.

parked:
Intentionally deferred. It is not deleted and it is not memory.

## Accessibility Rule

Color is never the only carrier of meaning.

Labels, text, borders, and structure must remain understandable without color.

## Make Space Rule

Make Space is a visual design principle in this pass, not a button, mode, or new capability.

Make Space means:

- reduce overlap
- restore breathing room
- clarify hierarchy
- move low-priority material away from active work
- make the board cleaner and more beautiful without adding decoration

## Explicit Boundaries

Visual status is not:

- evidence
- confidence
- memory
- priority persistence
- task tracking
- a new API field
- a new board object type

The current API remains `reply + threadBoard`.

`AxisCardStatus` is local presentation vocabulary for the current Thread Board and BoardSectionObject renderer. It does not create persistence, manual status controls, evidence, memory, or a new mode.
