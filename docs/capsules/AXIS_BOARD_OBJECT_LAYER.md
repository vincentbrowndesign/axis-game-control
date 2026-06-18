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

## Acceptance Boundary

This capsule is correctly defined when:

- the repo has a written boundary for future board objects
- the Capability Index marks it as Future and Define Capsule
- the Build Map still prevents it from becoming Build Now
- current `/axis` behavior is unchanged
- current `/api/axis/conversation` still returns only `reply + threadBoard`
- no future layer is accidentally implemented

