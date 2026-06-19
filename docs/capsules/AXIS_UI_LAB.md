# Axis UI Lab

Status: Internal preview surface
Active Product: No
Route: `/axis/lab`
Version: v1

## Locked Boundary

Axis UI Lab is a design-validation surface. It is not a second Axis product mode.

The active product remains `/axis`.

## Design Thesis

Axis should feel like a blank page that understands you.

## Interaction Thesis

Invisible chrome. Visible understanding.

## What Failed in Lab v0

- dashboard framing
- permanent three-column shell
- permanent inspector panel
- default card grid as the opening view
- equal emphasis across too many objects at once
- interface chrome competing with the work

## Lab v1 Principles

- current work remains central
- timestamps live in the margin, not in the content column
- annotations appear only when useful
- right margin is empty until selection
- Make Space reduces visible material, not expands it
- one object expands at a time
- composer is quiet but discoverable
- status remains visible at all times
- mobile becomes one intentional vertical flow
- iPad remains one centered surface, not a split shell
- color behaves like a pencil mark — restrained accent, never the only signal

## What the Lab Is

- internal UI preview only
- mock-data-driven
- manually accessed at `/axis/lab` by direct URL
- isolated from all live runtime
- safe to delete without affecting `/axis`

## What the Lab Is Not

- a new Axis product mode
- a second product surface
- a dashboard or workspace switcher
- a replacement for `/axis`
- a persistence layer
- an auth surface
- a Data Asset runtime

## Mock-Only Rule

`/axis/lab` uses local static data and local React state only.

It must not call:

- `/api/axis/conversation`
- `/api/axis/threads`
- Supabase
- auth endpoints
- upload endpoints
- server actions

It must not import:

- thread persistence helpers
- auth helpers
- Supabase clients
- Data Asset runtime code

Refresh may reset the lab completely.

## Lab v1 States

The lab previews four states accessible from the lab control bar:

| State | What it shows |
|---|---|
| Empty | Opening surface — prompt, hint, quiet composer |
| Active | One dominant user thought, quieter Axis response, timestamp in left margin, annotations in right column |
| Make Space | Collapsed list — KEEPER, QUESTION, PROOF NEEDED, NEXT MOVE; one expands at a time |
| Expanded | Make Space with the first item pre-opened — static preview of the expanded object |

Allowed local interactions:

- switch between lab states
- type into the composer and submit a local thought
- expand and close one Make Space item at a time
- keyboard-navigate and close via Escape
- reset the local preview

Disallowed:

- API calls
- Supabase calls
- auth calls
- persistence
- drag-and-drop
- manual board creation
- file upload
- media recording or access
- real save
- real conversation calls

## Responsive Targets

| Breakpoint | Behavior |
|---|---|
| Desktop | One centered work surface; margin timestamps; right margin free until selection |
| iPad landscape | One centered wide sheet; no three-column shell |
| iPad portrait | Centered readable column; timestamps close to content; no clipping |
| Phone | One vertical flow: header → current work → annotations/results → composer |

## Accessibility Requirements

Every interactive element must have:

- accessible label (`aria-label` or visible text)
- keyboard focus and focus-visible style
- visible active feedback

Progressive disclosure (Make Space expanded object) must:

- use `aria-expanded` and `aria-controls`
- support Escape to close
- return focus to the row button on close
- support click-outside to close
- respect `prefers-reduced-motion`

## Composer Rule

The lab composer must:

- feel like a writing line, not a chat input
- show multimodal affordances (mic, camera, file) only on focus
- make no API calls on submit
- show "Preview only · not connected" for all multimodal affordances
- clear the input after local submission
- submit on Enter (Shift+Enter for newline)

## Visual Language Boundary

The lab imports shared Axis visual-language tokens from `src/lib/axis-visual-language.ts`.

It must not duplicate or modify shared token values.

Status color is a restrained accent only. Color is never the only carrier of meaning.

## Promotion Rule

Lab components may be promoted into `/axis` only through an explicit replacement decision.

Promotion requires:

- live responsive validation
- accessibility validation
- confirmation that `/axis` behavior remains intact
- confirmation that API and persistence boundaries remain unchanged

Deleting the lab must not affect `/axis`.
