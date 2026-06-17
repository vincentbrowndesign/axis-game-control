# Repo Cleanup

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
