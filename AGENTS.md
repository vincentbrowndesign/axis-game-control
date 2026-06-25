# AGENTS.md

---

## CURRENT PRODUCT DIRECTION - 2026-06-23

Read this first. It supersedes older product framing.

Active MVP: Axis basketball session memory at `/axis`.

Axis is a basketball session memory system.

First product win:

```text
Open phone
-> sign in
-> start session
-> type / talk / tap moment
-> end session
-> memory exists
```

| Item | Value |
|---|---|
| Active page | `src/app/axis/page.tsx` |
| Active session API | `src/app/api/axis/sessions/route.ts` |
| Source of truth | `docs/AXIS_INDEX.md` |
| Product map | `docs/AXIS_PRODUCT_MAP.md` |
| Build map | `docs/AXIS_BUILD_MAP.md` |
| Design rules | `docs/AXIS_DESIGN_CONSTITUTION.md` |
| Mobile rules | `docs/AXIS_MOBILE_PRIORITY.md` |
| Session memory capsule | `docs/capsules/AXIS_SESSION_MEMORY.md` |

Do not wire `/api/axis/run`, CV, video, replay, upload, evidence, mission, or dashboard infrastructure into `/axis` unless an active build ticket explicitly unlocks that layer.

Do not show APIs, routers, provider names, model names, JSON, raw detections, FPS, frame counts, track IDs, rim setup, zones, calibration, or debug UI on the main `/axis` landing screen.

Do not treat docs in `docs/reference/` or old markdown recovered from git history as current build direction.

---

## Current Build Gate

Before coding Axis product work, read:

1. `docs/AXIS_INDEX.md`
2. `docs/AXIS_PRODUCT_MAP.md`
3. `docs/AXIS_BUILD_MAP.md`

Only build items marked Build Now or Refine Current in the active build map.

Future, reference, research, lab, or old capability docs may inform decisions, but they do not unlock implementation.

---

## Axis Session Memory Behavior

Axis should:

* start a session quickly on a phone
* capture typed/tap moments even when camera, mic, AI, or network fails
* structure rough input into useful session memory
* show the last interpreted moment
* let the user correct or mark review
* end the session cleanly
* make saved/local memory visible
* keep advanced tools hidden by default

Axis should not:

* require camera, voice, upload, or AI before memory can be created
* become a raw AI camera demo
* become a desktop analytics dashboard
* expose debug machinery on the main screen
* create fake stats or unsupported basketball truth

---

## Active MVP Boundaries

Current MVP is mobile-first session memory.

Do not add to the active `/axis` landing screen:

* Mission Control or mission language
* analytics dashboards
* provider/API menus
* debug panels
* raw detections
* FPS or frame counters
* track IDs
* rim setup on landing
* zones or calibration on landing
* uploads as a required first flow
* voice-first requirement
* camera-first requirement
* long-term player model
* automatic scouting reports
* fake stats
* role modes
* desktop sidebars

These may exist as preserved infrastructure in the repo. They are not active product truth unless explicitly unlocked.

---

## Axis Data Asset Boundary

Axis Data Asset Contract v0 is an active foundation and remains documentation/contract-level unless explicitly unlocked.

Operational Data Asset runtime remains future.

Do not create:

* persistent Source Records
* persistent Structured Records
* automatic datasets
* verified assets
* Keeper workflows
* cross-thread player memory
* reports as automatic truth
* sponsor/subscription/marketplace runtime

Session persistence must not become inferred truth, automatic player memory, or automatic Data Asset promotion.

---

## Legacy / Future Boundaries

Preserved infrastructure - do not remove without explicit direction:

* `src/app/api/axis/run`
* `src/app/api/axis/conversation`
* `src/app/api/axis/whiteboard`
* CV/video/replay/upload/evidence routes
* `src/lib/`
* `supabase/migrations/`
* `docs/reference/`

Do not wire preserved infrastructure back into `/axis` without a documented migration decision.

---

## Engineering Rules

* Inspect before deleting.
* Prefer small, scoped changes.
* Do not rewrite unrelated code.
* Do not touch secrets or environment files.
* Do not commit generated runtime files (`.runtime-audit/`, `.trigger/`, `.trigger-dev.*.log`, `.tmp-*`, `axis-*.png`).
* Run available checks before reporting completion.

---

## Required Task Structure

Every task must identify:

1. Goal.
2. Files changed.
3. What was intentionally not touched.
4. Verification run.

---

## Checks

Use only scripts that exist in `package.json`:

* `npx tsc --noEmit` - TypeScript check
* `npm run build` - Next.js build
* `npm run lint` - ESLint (note: pre-existing warnings are broad; focus on changed files only)

---

## Final Report Format

Always report:

* files changed
* files deleted or archived
* active route and API
* checks passed or failed
* commit hash
* remaining risks

---

## Next.js Notes

This version has breaking changes from training data. APIs, conventions, and file structure may differ.

Before modifying Next.js behavior:

* read the relevant guides inside `node_modules/next/dist/docs/`
* check for deprecations
* preserve existing routing and infrastructure
* avoid unnecessary architectural rewrites
