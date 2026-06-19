# Axis UI Lab

Status: Internal preview surface
Build Decision: Build Now - mock-only test route
Active Product: No
Route: `/axis/lab`

## Locked Boundary

Axis UI Lab is a design-validation surface. It is not a second Axis product mode.

The active product remains `/axis`.

## Purpose

Axis UI Lab gives the team a safe place to evaluate room layout, status-aware board cards, timeline rhythm, inspector behavior, and composer placement before any interface replaces the active `/axis` surface.

## What The Lab Is

- internal UI preview
- mock-data-driven
- manually accessed by direct URL
- isolated from live runtime
- safe to delete without affecting `/axis`

## What The Lab Is Not

- a new Axis mode
- a second product surface
- a dashboard
- a workspace switcher
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

## Promotion Rule

Lab components may later be promoted into `/axis` only through an explicit replacement decision.

Promotion requires:

- live responsive validation
- accessibility validation
- confirmation that `/axis` behavior remains intact
- confirmation that API and persistence boundaries remain unchanged

Deleting the lab later must not affect `/axis`.

## Current Preview

The v0 lab previews:

- session timeline
- current focus board
- status-aware mock cards
- read-only selected-card inspector
- local-only composer
- mock save-state control

Allowed local interactions:

- select a board card
- show the selected card in the inspector
- append a local preview message
- switch mock save states
- reset the local preview

Disallowed:

- API calls
- Supabase calls
- auth calls
- persistence
- drag/drop
- manual board creation
- file upload
- real save
- real conversation calls

## Visual Language Boundary

The lab may import shared Axis visual-language tokens from `src/lib/axis-visual-language.ts`.

It must not duplicate or change shared token values.

Status color remains a restrained accent only. Color is never the only carrier of meaning.
