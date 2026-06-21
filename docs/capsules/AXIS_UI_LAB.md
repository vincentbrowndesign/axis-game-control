# Axis UI Lab

Status: Internal preview surface
Build Decision: Build Now - mock-only test route
Active Product: No
Route: `/axis/lab`

## Current Purpose

Axis UI Lab currently tests a mock-only Game Source Surface inspired by the approved reference language.

The lab surface:

- is not yet the active `/axis` product
- contains no live Lens, CV, evidence, upload, or Data Asset behavior
- uses local mock data only
- may promote presentation components only through an explicit product decision
- places the game/source in the center, context on the edges, and action at the bottom

## Shell Promotion

The approved Context Dashboard presentation shell has been promoted into shared components at:

`src/components/axis/context-dashboard/`

This promotion is presentation-only.

The shared shell:

- is prop-driven
- contains no mock data
- contains no API calls
- contains no Supabase, auth, persistence, media, Lens, CV, evidence, memory, or Data Asset runtime
- may be used by `/axis` only as current-thread presentation

The lab may import the shared shell and feed it local mock data.

Lab-only behavior remains lab-only:

- Reality Marks
- visual-source mock behavior
- preview-only microphone, camera, upload, add moment, add action, and add source controls
- local mock data

Production code must not import from `src/components/axis/lab/`.

## Locked Boundary

Axis UI Lab is a design-validation surface. It is not a second Axis product mode.

The active product remains `/axis`.

Deleting `/axis/lab` and all files under `src/components/axis/lab/` must not affect `/axis`.

Deleting `/axis/lab` must not delete the promoted shared shell under `src/components/axis/context-dashboard/`.

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

The active lab preview is a Game Source Surface mock with:

- top header
- thread timeline
- center Source Window
- source link reference
- mock camera placeholder
- local source clock
- local session clock
- Reality Mark action surface
- Live Read
- proof needed
- next move
- keeper
- proof candidates
- open loops
- actions
- preview-only composer
- Recent Reality shelf

Desktop preserves a three-region game surface with the Source Window dominant. Tablet portrait and phone collapse into a single readable flow.

## Axis Game Source Surface and Reality Marks v0

Axis Game Source Surface and Reality Marks v0 exist only in `/axis/lab`.

It is a local game-use preview for holding a source reference, manually timestamping moments, and seeing how those moments might shape a review surface.

During live-game use, the lab rule is mark, glance, and recover: no long typing, no media capture, and no verified claims.

Source behavior:

- source link is a local reference only, not ingestion
- mock camera is a visual placeholder only, not camera access
- local source clock is clock sync only, not media sync
- linked sources must say no analysis
- mock camera must say no camera connected

Reality Marks:

- use local React state only
- mark human-selected moments
- may be created from the preview composer `+` menu or the mobile game surface
- appear in the local Thread Timeline
- appear at the start of Recent Reality
- may create local proof-candidate suggestions for proof-like labels
- may update the local Live Read preview
- reset on refresh
- are disabled unless the local game session is live
- may point to a local source id when a local source reference exists

Every created Reality Mark is:

- `sourceType: manual`
- `provenance: manual`
- `verification: unverified`
- `preRollSeconds: 15`
- `postRollSeconds: 10`

The lab source clock is a local clock only. It does not connect to media, request device permissions, attach files, or synchronize with a real video source.

The Live Read preview is deterministic and conservative:

- it uses manual labels, counts, notes, and timestamps only
- it shows Pattern, Proof Needed, and Next
- it labels every derived item as local preview / manual input / unverified
- it must not say Axis detected, saw, proved, confirmed, or verified anything

Reality Marks do not:

- capture media
- open camera, microphone, upload, or file-picker controls
- perform CV
- create evidence
- create Witness verdicts
- persist to storage
- create Data Asset records
- activate Axis Lens
- create evidence

A `clip` Reality Mark is only a marker for a moment. It does not contain a clip, capture video, or prove anything.

Reality Mark proof candidates require future confirmation. They are local UI suggestions only.

Axis Lens, CV, media capture, evidence verification, storage, persistence, and Data Asset promotion remain inactive. Any promotion from this lab preview into the active product requires a separate product decision.

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
