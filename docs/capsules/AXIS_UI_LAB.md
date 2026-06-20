# Axis UI Lab

Status: Internal preview surface
Build Decision: Build Now - mock-only test route
Active Product: No
Route: `/axis/lab`

## Current Purpose

Axis UI Lab currently tests a mock-only Context Dashboard inspired by the approved reference.

The dashboard:

- is not yet the active `/axis` product
- contains no live Lens, CV, evidence, upload, or Data Asset behavior
- uses local mock data only
- may be promoted only through a separate product decision

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

## Current Mock Surface

The active lab preview is a Context Dashboard mock with:

- top header
- thread timeline
- active context
- proof needed
- next move
- keeper
- proof candidates
- open loops
- actions
- preview-only composer
- Recent Reality shelf

Desktop preserves the three-region reference layout. Tablet portrait and phone collapse into a single readable flow.

## Mock-Only Rule

`/axis/lab` uses local static data only.

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
- Lens, CV, media ingestion, or storage runtime code

Preview controls for microphone, camera, upload, add moment, add action, and add source must not request permissions, open pickers, upload files, save data, or call APIs.

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
