# Repo Cleanup

## Whiteboard Correction Pass — 2026-06-17 (Final Pass)

### Why this pass was needed

The initial Axis Whiteboard Layer implementation treated the whiteboard as a separate product — a blank canvas with floating card nodes, SVG bezier arrows, push-pin accents, and an absolute-position layout algorithm. This felt disconnected from the conversation thread and violated the principle that the conversation is the product.

### What changed

**`src/app/api/axis/whiteboard/route.ts`** — Complete rewrite.

Old: returned `{title, nodes[], edges[]}` — a node-edge graph for canvas layout.

New: returns `{title, summary, sections[], connections[], primitives{}}` — a comprehension-page structure.

The new system prompt instructs the API to:
1. Reason silently with internal primitives (Points, Relationships, Groups, Time, Evidence, States, Changes)
2. Output user-facing sections: Main Idea · What We Noticed · What It Means · Evidence / Signals · Next Move
3. Never expose primitive labels to the user

The primitives organize the board. They are not the board.

**`src/app/axis/whiteboard-view.tsx`** — Complete rewrite.

Old: canvas-based layout with absolute-positioned cards, SVG bezier arrows, push-pin accents, numbered circles, layout algorithm, dot-grid full background.

New: page-based section layout. Title + summary at top. Sections as clean white cards with small uppercase labels. Items in Kalam font. Mobile-first single column, 2-column grid at 580px+. Main Idea and Next Move span full width. Connections shown as plain text below sections if present.

Blank/early state: "Keep the conversation going. Whiteboard organizes the thread once there is something to understand."

**`AGENTS.md`** — Added `## Axis Whiteboard Boundary` section defining what whiteboard is and is not, internal primitives, user-facing sections, and what agents must not add.

### What was not touched

- `src/app/axis/page.tsx` — view toggle and WhiteboardView mount unchanged
- `src/app/api/axis/conversation/route.ts` — conversation API unchanged
- All legacy/preserved infrastructure

### Design rule confirmed

> Primitives organize the board. They are not the board.

The API uses internal primitives to reason. The user sees human-readable sections. The distinction must never collapse.

---

## AGENTS.md Trim — 2026-06-17 (Pass 4)

### Why this pass was needed

After Pass 2 added a `CURRENT PRODUCT DIRECTION` section to the top of `AGENTS.md`, the file still contained ~280 lines of old product framing below it: check-in loop, leaderboard, surface hierarchy (top/center/bottom), mission language, old design rules, and language tables from the prior athletic continuity product. A coding agent reading the full file could absorb that framing and reintroduce old product patterns into the active MVP.

### What was removed from `AGENTS.md`

Old product framing that described Axis as a check-in / leaderboard / sports continuity system:

* Product loop: `show up → check in → participate → history grows → leaderboard → return tomorrow`
* Stabilized product direction hierarchy
* Core Product Truth (old athletic continuity definition)
* Codex Responsibilities (streaks, check-in, overlay, electronics identity)
* Surface Hierarchy (top/center/bottom with athletic identity, Check In, Axis History, leaderboard)
* Replay + Upload Rules (participation memory, continuity archive framing)
* Intelligence Rules (invisible/ambient intelligence framing for the old product)
* Design Rules (emotional hardware references for old product feel)
* UI Rules (structural layouts, lime accents, black athletic hardware)
* Product Language Rules (use/avoid tables for old product vocabulary)
* "Do Not Add" list (referred to old product shape, not current conversation MVP)
* Old Stability Rules (built around the check-in/progression/leaderboard loop)

### What was kept in `AGENTS.md`

* Current Product Direction table (active route, API, source of truth)
* Axis Conversation Behavior (what Axis should and should not do in conversation)
* Active MVP Boundaries (full list of what must not be added to `/axis`)
* Legacy / Future Boundaries (what is preserved and must not be deleted)
* Engineering Rules (inspect before deleting, small scoped changes, no secrets, no runtime artifacts)
* Required Task Structure (goal / files changed / not touched / verification)
* Checks (tsc, build, lint notes)
* Final Report Format
* Next.js Notes

### Archive created

`archive/AGENTS.legacy.md` — full prior AGENTS.md content preserved for historical reference.

### Local artifact `.gitignore` additions

These generated files were untracked and not in `.gitignore`. Added:

* `.runtime-audit/`
* `.trigger/`
* `.trigger-dev.err.log`
* `.trigger-dev.out.log`
* `.tmp-*`
* `axis-*.png`

### Why this prevents future drift

A coding agent that reads `AGENTS.md` now gets:
1. Current Product Direction (table, active files, what not to do)
2. Conversation behavior rules
3. What must not be added to `/axis`
4. What to preserve in the rest of the repo
5. Engineering safety rules

It no longer gets: check-in loop, leaderboard framing, surface hierarchy, athletic continuity philosophy, or old design/language rules.

---

## Context Cleanup — 2026-06-17 (Pass 3)

### Why this pass was needed

After the MVP rebuild and agent instruction alignment (Passes 1–2), stale `context/*.md` files remained in place alongside their archived copies in `archive/context/`. An agent scanning `context/` could still pick up old product framing (check-in loop, leaderboard, video overlay, reconstruction plans) and treat it as current direction.

### Files deleted from `context/` (already had archive copies)

These six files had already been copied to `archive/context/*.legacy.md` in Pass 1. The originals were removed:

- `context/core-loop.md` → `archive/context/core-loop.legacy.md`
- `context/current-seam.md` → `archive/context/current-seam.legacy.md`
- `context/interaction-philosophy.md` → `archive/context/interaction-philosophy.legacy.md`
- `context/progress-tracker.md` → `archive/context/progress-tracker.legacy.md`
- `context/project-overview.md` → `archive/context/project-overview.legacy.md`
- `context/ui-direction.md` → `archive/context/ui-direction.legacy.md`

### Files moved to `archive/context/` (newly archived this pass)

These eight files had no archive copy yet. They were copied to `archive/context/` and removed from `context/`:

| File | Reason |
|---|---|
| `context/AXIS_BUILD_ORDER.md` | Reconstruction build order for video/overlay product (2026-06-07) |
| `context/AXIS_CLEANUP_GUIDE.md` | Destructive deletion guide for old product — HIGH RISK if treated as current |
| `context/AXIS_RECONSTRUCTION_ARCHITECTURE.md` | Video overlay/reconstruction architecture |
| `context/AXIS_RECONSTRUCTION_EXECUTIVE_SUMMARY.md` | Reconstruction executive summary |
| `context/AXIS_RECONSTRUCTION_INDEX.md` | Reconstruction architecture index |
| `context/architecture.md` | Describes check-in/leaderboard/Clerk/Supabase stack as current |
| `context/runtime-boundaries.md` | "Axis active runtime is continuity-only" — stale product framing |
| `context/supabase-schema-audit.md` | Schema audit against old check-in product filter (2026-05-25) |

### `context/` directory state after this pass

`context/` now contains only `README.md` — a redirect note pointing to `docs/AXIS_CONVERSATION_MVP.md` and `docs/REPO_CLEANUP.md`.

Any agent that opens `context/` now sees the redirect immediately rather than stale product docs.

### What future agents should read first

1. `CLAUDE.md` — current MVP truth, then preserved agent rules
2. `docs/AXIS_CONVERSATION_MVP.md` — MVP scope, acceptance tests, anti-patterns
3. `docs/REPO_CLEANUP.md` — this file
4. `archive/context/` — historical context only, not current direction

---

## Alignment Pass — 2026-06-17 (Pass 2)

### Agent instruction files aligned

The following files were directing coding agents toward the old product direction (video overlay, check-in, leaderboard). They have been updated to clearly surface the current Axis Conversation MVP before any legacy content.

| File | Change |
|---|---|
| `CLAUDE.md` | Rebuilt. Current truth added before `@AGENTS.md` and `@AXIS_ENGINEERING_CONSTITUTION.md` includes. Agents now see the current MVP first. |
| `AGENTS.md` | `CURRENT PRODUCT DIRECTION` section added at top. Legacy product framing marked as historical context. Engineering rules preserved. |
| `AXIS_ENGINEERING_CONSTITUTION.md` | Warning header added. Purpose section marked as legacy/video infrastructure. Rules 4, 5, 9, 10 marked with infrastructure scope. Rules 1–3, 6–8, 11 preserved as timeless engineering principles. |
| `src/app/api/axis/run/route.ts` | File-level comment added marking it as legacy and pointing to `/api/axis/conversation`. |
| `README.md` | "Current Axis Source of Truth" section added. |

### `AXIS_ENGINEERING_CONSTITUTION.md` — kept, not archived

Decision: keep in place. The file contains strong engineering principles (Rules 1–3, 6–8, 11) that apply to the current MVP. Only the product-specific sections needed updating. The file now clearly labels what is legacy vs. timeless.

### `/api/axis/run` — preserved as legacy infrastructure

Status: **preserved, not used by MVP page**.

The route (`src/app/api/axis/run/route.ts`) contains the prior AxisUnderstanding system backed by Supabase. It is:
- Not wired into `src/app/axis/page.tsx`
- Not referenced from `src/app/api/axis/conversation/route.ts`
- Preserved in case future migrations want to reference it
- Marked with a file-level legacy comment

### What future agents should not touch without explicit direction

- Do not add dashboard, mission, card, sidebar, or leaderboard UI to `src/app/axis/page.tsx`
- Do not wire `/api/axis/run` back into the active page without a migration decision
- Do not re-introduce voice, camera, upload, or CV features into the active MVP
- Do not treat `archive/*.legacy.md` files as current product direction

---

## First Cleanup Pass — 2026-06-17 (Pass 1)

## What changed

### Active Axis MVP — rebuilt

`src/app/axis/page.tsx` was replaced entirely.

The old page was a notebook-style conversation system with:
- Thread memory (Supabase)
- Voice input (SpeechRecognition)
- File upload / evidence cards
- Sketch generation
- Erase mode
- Sidebar threads
- Complex card rendering (belief, try_this, show_me, see_it, etc.)

The new page is a clean text conversation:
- No database required
- No voice
- No upload
- No cards
- Conversation history lives in browser state for the session
- Axis opens with "What are we working on?"

### New API route

`src/app/api/axis/conversation/route.ts` — clean Axis conversation endpoint.

- POST `{ message, history }`
- Returns `{ reply }`
- No Supabase dependency
- Uses claude-sonnet-4-6 with the Axis system prompt

### Mission page — redirected

`src/app/axis/mission/page.tsx` (1772 lines) replaced with a redirect to `/axis`.

The old mission page was the prior active product surface: camera, voice, upload, coach witness, evidence evaluation, mission memory, context sidebar. It is no longer active.

---

## What was archived

These files contradict the current MVP direction and were copied to `archive/`:

| Original | Archived as |
|---|---|
| `AXIS_CONSTITUTION.md` | `archive/AXIS_CONSTITUTION.legacy.md` |
| `01-axis-understanding.md` | `archive/01-axis-understanding.legacy.md` |
| `context/core-loop.md` | `archive/context/core-loop.legacy.md` |
| `context/progress-tracker.md` | `archive/context/progress-tracker.legacy.md` |
| `context/ui-direction.md` | `archive/context/ui-direction.legacy.md` |
| `context/project-overview.md` | `archive/context/project-overview.legacy.md` |
| `context/current-seam.md` | `archive/context/current-seam.legacy.md` |
| `context/interaction-philosophy.md` | `archive/context/interaction-philosophy.legacy.md` |
| `design-system/AXIS_DESIGN_CONSTITUTION.md` | `archive/design-system/AXIS_DESIGN_CONSTITUTION.legacy.md` |

These files described prior product directions: check-in ritual, leaderboard, athletic continuity loop, replay-first, tactical coaching.

Original files remain in place and are not deleted.

---

## What files are current

| File | Status |
|---|---|
| `src/app/axis/page.tsx` | Active MVP page |
| `src/app/api/axis/conversation/route.ts` | Active conversation API |
| `src/app/page.tsx` | Root (renders /axis) |
| `src/app/axis/mission/page.tsx` | Redirect only |
| `README.md` | Updated |
| `docs/AXIS_CONVERSATION_MVP.md` | MVP spec |
| `docs/REPO_CLEANUP.md` | This file |

---

## What legacy areas remain

These are preserved and should not be touched unless explicitly requested:

### Infrastructure API routes (src/app/api/axis/)
All non-conversation API routes remain intact:
- `run/` — prior AxisUnderstanding conversation system (complex, Supabase-backed)
- `sketch/` — SVG generation
- `evidence/`, `ball/`, `video-job/`, `decode-video/`, etc. — CV/video pipeline
- `thread/` — thread memory
- `mission-memory/`, `orchestrator/`, `understand/`, etc.

### Library files (src/lib/)
All lib files preserved:
- `axis-operating-system.ts`, `axis-cv-overlay.ts`, `axis-ball-processing.ts`, etc.
- These are future capability infrastructure, not active MVP

### Database migrations (supabase/migrations/)
All migrations preserved. The MVP does not require a database, but the infrastructure is intact.

### Context docs (context/)
Files remain in place even though archived copies exist. Original context docs are not deleted.

---

## What should not be touched yet

- `src/lib/` — entire lib directory
- `src/app/api/axis/` — all non-conversation API routes
- `src/app/api/film/`, `src/app/api/work/`, `src/app/api/cloudflare/`
- `supabase/migrations/`
- `src/app/studio/`, `src/app/replay/`, `src/app/capture/`, `src/app/axis-ball/`
- `src/components/` — overlay and CV components

---

## Remaining cleanup risks

1. `CLAUDE.md` still references `AGENTS.md` and `AXIS_ENGINEERING_CONSTITUTION.md` which describe an overlay/video product direction. These are project instructions for the agent system — handle carefully.

2. `context/*.md` originals remain in place alongside their archived copies. The originals could still be loaded by agents reading `context/`. Consider deleting originals after confirming no active reference.

3. `src/app/api/axis/run/route.ts` is the prior complex conversation API. It is no longer used by the MVP page but is preserved. It could be archived once confirmed unused.
