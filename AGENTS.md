# AGENTS.md

---

## CURRENT PRODUCT DIRECTION — 2026-06-17

> **Read this first. It supersedes everything below.**

**Active MVP:** Axis Conversation at `/axis`.

The conversation itself is the product. Axis helps the work develop.

| Item | Value |
|---|---|
| Active page | `src/app/axis/page.tsx` |
| Active API | `src/app/api/axis/conversation/route.ts` |
| Saved thread API | `src/app/api/axis/threads` — exact owner-scoped thread persistence |
| Auth capsule | `docs/capsules/AXIS_AUTH.md` - explicit sign-in/sign-out for owner-scoped continuity |
| Legacy mission page | `src/app/axis/mission/page.tsx` — redirects to `/axis` |
| Legacy conversation API | `src/app/api/axis/run` — preserved, not used by MVP |
| Product truth | The conversation is the product |
| Source of truth | `docs/AXIS_CONVERSATION_MVP.md` |
| Repo cleanup record | `docs/REPO_CLEANUP.md` |
| Archived product docs | `archive/*.legacy.md` — historical context only |

**Do not** wire `/api/axis/run` into `/axis` unless intentionally migrating.
**Do not** re-introduce missions, dashboards, cards, check-in, or leaderboards into the active `/axis` page.
**Do not** treat the archived `.legacy.md` files as current product direction.

---

## Current Build Gate

Before coding Axis MVP work, read:

* `docs/AXIS_BUILD_MAP.md`
* `docs/capsules/AXIS_CAPABILITY_INDEX.md`

Only build items marked:

* Build Now
* Refine Current

Do not build Hold, Future Layer, Research Proof, or Do Not Build Yet items unless explicitly instructed.

---

## Axis Conversation Behavior

Axis should:

* notice what is forming
* name what is developing
* protect the important point
* make the work more useful, understandable, or real
* ask the smallest next question only when it moves the work forward
* keep narrowing ambiguity without interrogating
* give the user language they can use

Axis should not:

* frame the user as stuck
* ask generic AI questions
* sound like a consultant or coach cliché machine
* say "this sounds like a clarity problem"
* say "this feels like a product identity issue"
* ask "what are your goals?"
* ask "what challenges are you facing?"
* ask "can you provide more context?"

---

## Active MVP Boundaries

Current MVP is text-only. No other capabilities are active on `/axis`.

Axis may persist exact conversation threads and assistant Thread Board snapshots for the signed-in owner. This is not long-term player memory, cross-thread recall, evidence persistence, or persistent board arrangement.

Axis Auth v0 is active only to protect owner-scoped Thread Persistence:

* allow sign-in, account creation, sign-out, session restoration, and account switching
* clear saved thread list, active saved-thread id, loaded transcript, latest restored board, metadata, and save state when the owner changes
* keep signed-out conversation local and show "Sign in to save"
* do not add profiles, organizations, roles, billing, dashboard access, cross-thread memory, player memory, or Data Asset runtime operations

Do not add to the active `/axis` page:

* Mission Control or mission language
* dashboards
* objective or constraint panels
* progress panels
* evidence cards
* check-in or check-out flows
* leaderboard surface
* streaks
* uploads
* voice
* camera
* sketches
* analytics
* game tracking
* training tracker language
* role modes (coach mode, player mode, etc.)
* sidebar threads
* long-term database memory
* video overlay framing

These may exist as legacy or future infrastructure in `src/lib/` and `src/app/api/axis/`. They are not active in the current MVP.

---

## Axis Data Asset Contract Boundary

* Axis Data Asset Contract v0 is active as a foundation and complete.
* `93cfbfe` locked the technical vocabulary.
* `31a214f` locked the product and build boundaries.
* `src/lib/axis-data-assets.ts` defines future types.
* No current runtime creates or persists these objects.
* Thread Persistence remains exact-thread storage.
* Thread Persistence must not become cross-thread player memory, inferred truth, or automatic data asset promotion.
* Do not wire legacy player-model, evidence, mission, or AxisUnderstanding systems into the contract.
* Do not promote suggested records to verified.
* Do not build cross-thread player memory from this contract.
* Do not add a third Data Asset implementation chunk yet.
* Operational Data Asset Layer remains future.

Current runtime priorities:

1. Active-thread entity integrity
2. Live Supabase persistence verification
3. Thread Board quality

---

## Axis Whiteboard Boundary

Whiteboard is a thread comprehension view. It organizes the current Axis conversation thread into a readable board.

Whiteboard is **not** a separate product, blank canvas, diagramming tool, hierarchy view, evidence engine, memory layer, or dashboard.

Whiteboard **is** a page-based layout of sections generated entirely from the conversation history. Internal primitives drive the API reasoning but are never exposed to the user.

Internal primitives (API only — never shown to the user):
Points · Relationships · Groups · Time · Evidence · States · Changes

User-facing sections (what the board shows):
Main Idea · What We Noticed · What It Means · Evidence / Signals · Next Move

Files:
- `src/app/api/axis/whiteboard/route.ts` — Whiteboard API
- `src/app/axis/whiteboard-view.tsx` — Whiteboard component
- `src/app/axis/page.tsx` — View toggle (Conversation | Whiteboard)

Blank/early state message: "Keep the conversation going. Whiteboard organizes the thread once there is something to understand."

Do not:
- Add manual editing or drag-and-drop to the whiteboard
- Expose primitive labels to the user
- Make whiteboard a separate page or route
- Persist whiteboard state in the database
- Add a canvas, floating cards, or SVG arrow layout

---

## Legacy / Future Boundaries

Preserved infrastructure — do not remove without explicit direction:

* `src/app/api/axis/run` — prior AxisUnderstanding conversation system (Supabase-backed)
* `src/app/api/axis/sketch` — SVG generation
* `src/app/api/axis/evidence/`, `ball/`, `video-job/`, etc. — CV/video pipeline
* `src/lib/` — all lib files (axis-operating-system, axis-cv-overlay, axis-ball-processing, etc.)
* `supabase/migrations/` — all DB migrations
* `archive/` — all archived docs

Do not wire preserved legacy infrastructure back into `/axis` without a documented migration decision.

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

* `npx tsc --noEmit` — TypeScript check
* `npm run build` — Next.js build
* `npm run lint` — ESLint (note: pre-existing warnings are broad; focus on changed files only)

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

---

## Legacy Agent Instructions

The old AGENTS.md contained product framing for prior Axis directions (check-in loop, leaderboard, surface hierarchy, mission/overlay product). That content has been archived at:

`archive/AGENTS.legacy.md`

It is historical context only.
