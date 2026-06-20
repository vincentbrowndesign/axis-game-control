# Axis UI Lab

Status: Internal preview surface
Active Product: No
Route: `/axis/lab`
Version: v1

## Locked Sentence

**Axis is not a page stack. Axis is an aperture.**

## Active Product Boundary

The active product is `/axis`. The lab is not `/axis`.

Deleting `/axis/lab` and all files under `src/components/axis/lab/` must not affect `/axis`.

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

## Aperture Shell — Core Rule

**The center is sacred.**

The aperture shell uses CSS Grid (`1fr min(640px, 100%) 1fr`) to keep the center column fixed. No port content — left, right, top, bottom — may reflow or shift the center column.

Rules:
- Ports are margins, not columns. They hold orientation marks, not primary content.
- Edge content must not reflow the center.
- Focus changes without page or mode changes.
- The right edge is empty until useful.
- Ports disappear at narrow widths. The center expands to fill.

What the ExpansionLayer is for:
- Temporarily overlaying a selected detail on top of the shell without creating a new column or moving the center.
- The ExpansionLayer sits at `z-index: 10`, `position: absolute; inset: 0`. It must be opened and closed explicitly. Escape key always closes it. Focus returns to the opener.

## Lab v1 Principles

- current work remains central
- timestamps live in the margin, not in the content column
- annotations appear only when useful
- right margin is empty until selection
- Make Space reduces visible material, not expands it
- one object expands at a time
- composer is quiet but discoverable
- status remains visible at all times
- color behaves like a pencil mark — restrained accent, never the only signal
- mobile becomes one intentional vertical flow
- iPad remains one centered surface, not a split shell

## What the Lab Is

- internal UI preview only
- mock-data-driven
- manually accessed at `/axis/lab` by direct URL
- isolated from all live runtime
- noindex / nofollow
- safe to delete without affecting `/axis`
- no primary navigation link from any product surface

## What the Lab Is Not

- a new Axis product mode
- a second product surface
- a dashboard or workspace switcher
- a replacement for `/axis`
- a persistence layer
- an auth surface
- a Data Asset runtime
- a media player or video tool

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

The lab previews states accessible from the lab control bar:

| State | What it shows |
|---|---|
| Empty | Opening surface — prompt, hint, quiet composer |
| Active | One dominant user thought, quieter Axis response, timestamp in left margin, annotations in right column |
| Make Space | Collapsed list — KEEPER, QUESTION, PROOF NEEDED, NEXT MOVE; one expands at a time; prior thought fades above |
| Expanded | Make Space with the first item pre-opened — static preview of the expanded object |

Allowed local interactions:
- switch between lab states
- type into the composer and submit a local thought
- expand and close one Make Space item at a time
- keyboard-navigate and close via Escape
- reset the local preview
- select a lens frame to open source view (lens states only)
- close source view with button or Escape

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

## Aperture Focus States

Focus states are URL-driven test configurations. They are not product modes.

| URL param | Focus | Initial lab state | Left port | Right port |
|---|---|---|---|---|
| `?focus=quiet` | `quiet` | Active | Timestamp | Empty |
| `?focus=input-active` | `input_active` | Active | Timestamp | Empty; composer pre-focused |
| `?focus=annotation` | `annotation_visible` | Active | Timestamp | PATTERN + PROOF NEEDED marks |
| `?focus=make-space` | `make_space` | Make Space | — | — |
| `?focus=lens-preview` | `lens_preview` | Active | Frame time marks | SOURCE CANDIDATE + OPEN QUESTION |
| `?focus=source-expanded` | `source_expanded` | Active → Source open | — | SOURCE + PATTERN marks |
| (no param) | `annotation_visible` | Active | Timestamp | Annotation marks |

## Lens UI Bridge — Mock Boundary

The Lens UI Bridge preview shows how a clip or frame might briefly enter Axis without turning the product into video software.

It is entirely mock. No CV, camera, file picker, media permission, upload, or analysis occurs.

Evidence language rules:
- Source candidates are not verified evidence.
- Use "candidate," "possible," and "needs confirmation."
- Do not say "Axis saw" or "the clip proves."
- Source and confidence must both be visible.
- Color is not the only status signal on any candidate.

The lens bridge preview may be replaced or extended only through an explicit CV promotion decision. CV capability does not flow into this shell automatically.

## Responsive Targets

| Breakpoint | Behavior |
|---|---|
| Desktop (≥ 960px) | One centered surface; left/right ports visible as margins |
| iPad landscape (~1024px) | Same as desktop; ports remain visible |
| iPad portrait (~768px) | Center expands; ports hidden; no horizontal clipping |
| Phone (< 640px) | One vertical flow; ports hidden; timestamp appears inline in center |

Ports hide at `max-width: 860px`. At that width, the center column takes full width via `min(640px, 100%)`.

No `100vw` values permitted in lab CSS. The lens strip uses `overflow-x: auto` and scrolls within its container.

## Accessibility Requirements

1. Semantic DOM order preserved in aperture grid.
2. Selectable annotations and candidates are `<button>` elements.
3. Expandable candidates use `aria-expanded` (boolean) and `aria-controls`.
4. Escape closes the ExpansionLayer (candidate detail panel) and any open source view.
5. Focus returns to the opener after the ExpansionLayer or source view closes.
6. No hover-only controls — all affordances visible on keyboard focus.
7. Color is never the only status cue — shape or text accompanies every accent.
8. Animations and transitions are wrapped in `@media (prefers-reduced-motion: no-preference)`.
9. Lens frame touch targets are at least 44px height.
10. Source and confidence language is plain text, readable by screen readers.

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

The Lens UI Bridge may be promoted into a real sensing layer only through a separate CV promotion decision. That decision requires the Axis Lens capsule (`Do Not Build Yet`) to be advanced, which requires an explicit build gate change in `docs/capsules/AXIS_CAPABILITY_INDEX.md`.
