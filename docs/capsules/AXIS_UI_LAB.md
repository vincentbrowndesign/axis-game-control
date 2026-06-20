# Axis UI Lab

Status: Internal preview surface
Build Decision: Build Now - mock-only test route
Active Product: No
Route: `/axis/lab`

## Locked Boundary

Axis UI Lab is a design-validation surface. It is not a second Axis product mode.

The active product remains `/axis`.

Deleting `/axis/lab` and all files under `src/components/axis/lab/` must not affect `/axis`.

## Product State Lock

The lab has exactly three product states:

- `empty`
- `active`
- `expanded`

State is selected only through URL query params:

- `/axis/lab?state=empty`
- `/axis/lab?state=active`
- `/axis/lab?state=expanded`

`/axis/lab` defaults to `active`.

The visible product shell must not render:

- lab state controls
- debug toggles
- state switchers
- developer toolbar

Do not create hidden intermediate product states.

## Surface Rule

The lab uses one root surface and one centered work column.

Do not implement left, center, and right as grid columns.

Timestamp, context, and proof marks may use anchored placement on wide screens, but they must:

- remain in logical DOM reading order
- not reduce the width of current work
- not shift the current thought
- become inline on narrow screens

## Visible Hierarchy

Default hierarchy is limited to:

Work:

- current thought
- one supporting Axis sentence

Context:

- at most one quiet context mark

Proof:

- at most one proof-needed mark

Action:

- soft composer or one next-action mark

Hide any role that has no useful content. Do not render empty containers or placeholder regions.

## Expansion Rule

Only one detail object may be expanded at a time.

Expanded detail is temporary:

- overlay or anchored detail on wide screens
- inline expansion on mobile
- Escape closes
- click outside closes where appropriate
- focus returns to the opener

Expanded detail may contain:

- source
- confidence
- related notes
- action

It must not contain:

- database ids
- metadata tables
- editing tools
- status control panels
- Data Asset operations
- evidence verification controls

## Visual Treatment

Use one component treatment.

- collapsed marks use quiet text plus a small accent
- expanded detail uses one calm paper surface
- no full-card status colors
- color appears only as a 2px mark, dot, underline, or short hairline
- use one spacing scale and one typography scale across all states

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

## Direct URL Rule

The lab remains:

- noindex / nofollow
- direct URL only
- absent from primary navigation
- absent from Threads
- absent from the active Axis header
- absent from redirects

## Promotion Rule

Lab components may be promoted into `/axis` only through an explicit replacement decision.

Promotion requires:

- live responsive validation
- accessibility validation
- confirmation that `/axis` behavior remains intact
- confirmation that API and persistence boundaries remain unchanged
