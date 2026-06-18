# Axis Board Object Layer

Status: Future
Build Decision: Define Capsule
Active Build: No

Locked sentence:

Axis should make every useful piece of understanding object-ready before it makes objects permanent.

## Purpose

The Axis Board Object Layer defines a future boundary for the Axis Whiteboard Renderer and spatial board objects.

This is not an implementation request. This capsule exists so future work can talk about board objects without accidentally building a manual whiteboard app inside the current MVP.

## Current MVP Boundary

The active MVP remains:

- Axis Conversation Layer
- Axis Understanding Primitives
- Axis Thread Board

The current API contract remains:

```json
{
  "reply": "string",
  "threadBoard": null
}
```

When a board exists, `threadBoard` still uses the existing `ThreadBoardData` shape:

```json
{
  "title": "string",
  "summary": "string",
  "sections": []
}
```

The current product should keep making Thread Board sections compact, readable, and object-ready without creating stored objects.

## What Object-Ready Means Now

Object-ready means each useful piece of understanding can stand on its own visually and semantically.

Current Thread Board sections may have:

- clear labels
- compact items
- stable visual treatment
- stable type or label tokens
- readable spacing
- enough structure to become objects later

Object-ready does not mean persisted objects, movable objects, manual editing, or a new schema.

## Future Object Candidates

A future Board Object Layer may define objects such as:

- observation object
- pattern object
- relationship object
- question object
- hypothesis object
- intervention object
- outcome object
- evidence object
- annotation object
- sketch object
- media object

These are candidates only. They are not active implementation work.

## Explicitly Not Build Now

Do not build these from this capsule yet:

- `AxisBoardItem`
- `board_items` API
- draggable cards
- absolute-position canvas
- x/y coordinates
- pan or zoom
- manual board toolbar
- add note
- add card
- clear board
- image or sketch upload
- evidence layer
- memory
- persistence
- Supabase storage
- camera
- voice
- CV
- replay
- Three.js
- 3D

## Future Renderer Boundary

The future Axis Whiteboard Renderer may eventually render board objects in space.

Before that happens, Axis must prove that generated Thread Board sections are useful enough to deserve permanence. The user should not manually build the board before Axis can reliably organize the conversation.

The migration path should be:

1. Conversation creates useful understanding.
2. Thread Board renders useful sections.
3. Sections become object-ready.
4. A future renderer defines object permanence.
5. Only then should spatial editing, persistence, or evidence attachments be considered.

## Relationship To Thread Board

Thread Board is active.

Board Object Layer is future.

Thread Board owns:

- current title
- current summary
- current generated sections
- defensive rendering
- compact live-use readability

Board Object Layer may later own:

- durable board objects
- object identity
- spatial placement
- object relationships
- renderer contracts
- attachment boundaries

Until this capsule moves beyond Define Capsule, Thread Board must not emit or store board objects.

## Promotion Gate: Define Capsule to Build Now

Before Board Object Layer moves from Define Capsule to Build Now, Axis must prove that Thread Board sections are consistently useful enough that making one section movable, stable, and editable would improve live use instead of turning Axis into a manual whiteboard app.

### 1. Smallest Board Object

Name:

BoardSectionObject

Definition:

A BoardSectionObject is one generated Thread Board section made object-ready.

It is not:

- a card
- a sticky note
- a node
- a freeform object
- a user-created note
- evidence
- memory

Example:

GAMEPLAN

- Push before defense gets set
- Attack bigs in space
- Need roster to lock matchups

### 2. Data Ownership

A BoardSectionObject may own presentation/runtime data only:

- id
- sectionType
- label
- items
- position
- size if needed
- isPinned maybe later
- createdFromThreadMessageId
- updatedAt

It does not own meaning independently yet.

Meaning still comes from the conversation and Thread Board.

### 3. Source of Meaning

Thread Board remains the source for:

- title
- summary
- section label
- section type
- section items
- current organized understanding

Board Object Layer converts sections into object-like render units only after Thread Board has produced useful structure.

### 4. First User Controls

First build should allow very little:

- move section objects
- maybe collapse or expand a section
- maybe pin a section

Do not allow at first:

- add card
- add note
- upload
- freeform note creation
- drawing tools
- full manual content editing

Manual content editing should only be considered if movement alone fails the acceptance test.

### 5. Local Only

First Board Object Layer implementation must be local/session-only.

Local-only state may include:

- positions
- collapsed state
- temporary layout
- object selection

No database persistence.

No Supabase.

No memory.

Refresh may reset the layout.

### 6. Not Evidence

A board object is not evidence.

Even if it says KNOWN, OBSERVATION, or references a clip, it is still an organized claim or note.

Evidence requires:

- source
- attachment
- provenance
- confidence
- support relationship

That belongs to a future Evidence Layer.

### 7. Not Memory

A board object is not memory.

It does not represent:

- durable player knowledge
- long-term user history
- saved team strategy
- persistent learning

Memory requires:

- consent rules
- retrieval rules
- correction rules
- expiration rules

### 8. First Acceptance Test

Use this real thread:

1. "playing 2k26 started a my gm season seattle owls expansion team imma give you my roster in a second"
2. "we're playing the spurs give me a gameplan"
3. "scorer AJ Dybansa Jakucionis ballhandler"

Pass condition:

Axis produces Thread Board sections. Board Object Layer turns those sections into movable local objects.

The user can move:

- KNOWN
- ASSUMED
- GAMEPLAN
- NEED NEXT

The build still must not:

- change the API contract
- save to memory
- upload evidence
- manually create new objects
- add camera, voice, CV, persistence, or 3D

Locked sentence:

Axis must first prove generated understanding is worth arranging. Only then should Axis let the user arrange it.

## Acceptance Boundary

This capsule is correctly defined when:

- the repo has a written boundary for future board objects
- the Capability Index marks it as Future and Define Capsule
- the Build Map still prevents it from becoming Build Now
- current `/axis` behavior is unchanged
- current `/api/axis/conversation` still returns only `reply + threadBoard`
- no future layer is accidentally implemented
