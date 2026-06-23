# Axis

Axis is a basketball session memory system.

Axis captures any basketball session, turns what happened into structured memory, and helps the user search, review, correct, export, and build from it.

## Current Product Truth

The first product win is:

```text
Open phone
-> sign in
-> start session
-> type / talk / tap moment
-> end session
-> memory exists
```

The capture screen is not the whole product. The product is the memory system created from the session.

## Active Surface

- Main route: `/axis`
- Session draft API: `/api/axis/sessions`
- Build map route: `/axis/build-map`

## What Axis Is Now

- a mobile-first basketball session capture surface
- a structured session memory loop
- a system for creating searchable, reviewable, correctable memory
- useful even when camera, voice, AI, or internet are imperfect

## What Axis Is Not

- a debug dashboard
- a raw AI camera demo
- a provider/API menu
- a stat tracker first
- a desktop analytics workspace
- a CV or video product first

## Source Of Truth

Start here:

1. `docs/AXIS_INDEX.md`
2. `docs/AXIS_PRODUCT_MAP.md`
3. `docs/AXIS_BUILD_MAP.md`
4. `docs/AXIS_DESIGN_CONSTITUTION.md`
5. `docs/AXIS_MOBILE_PRIORITY.md`

## Development

```bash
npm run dev
```

Open `http://localhost:3000/axis`.

## Boundaries

Preserved backend infrastructure may exist for video, CV, artifacts, auth, jobs, exports, and processing.

Do not expose those systems on the main user surface unless the active build map explicitly unlocks that layer.
