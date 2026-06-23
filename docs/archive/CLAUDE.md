# AXIS — CURRENT PRODUCT TRUTH

Status: ARCHIVE

Why moved: older Claude instructions referenced the conversation MVP.

Current replacement source: `CLAUDE.md`, `AGENTS.md`, and `docs/AXIS_INDEX.md`

---

> **Read this first. It overrides everything below.**

## Active MVP: Axis Conversation

The current active product is **Axis Conversation** at `/axis`.

- Route: `/axis` (root `/` renders the same page)
- Page: `src/app/axis/page.tsx`
- API: `src/app/api/axis/conversation/route.ts`
- Product truth: **The conversation itself is the product.**
- Axis starts every session: "What are we working on?"
- Axis helps the work develop through conversation.

## What is NOT active on the current `/axis` page

These capabilities exist in the codebase as preserved infrastructure.
They are **not wired into the active MVP page** and must not be reintroduced without explicit direction:

- Voice / microphone
- Camera
- File upload / evidence
- Missions / Mission Control
- Dashboards
- Cards (belief, try_this, show_me, etc.)
- Check-in / leaderboard / streaks
- Replay / video overlay / CV / ball tracking
- Analytics
- Sidebar threads
- Long-term memory / Supabase thread storage
- Sketches

## Agent rules for the active surface

- Do not add dashboards, panels, or sidebars to `/axis`
- Do not re-introduce mission, check-in, or leaderboard language into `/axis`
- Do not treat Axis as a video overlay or sports analytics product on the active surface
- Do not frame the user as stuck
- Do not use consultant language ("clarity problem," "product identity issue," etc.)
- Keep MVP small — one page, one API, text only
- `src/app/api/axis/run` is **legacy/preserved infrastructure**, not the active conversation API

## Source of truth

- `docs/AXIS_CONVERSATION_MVP.md` — MVP scope, product truth, acceptance tests
- `docs/REPO_CLEANUP.md` — what changed, what was archived, what to not touch
- `archive/*.legacy.md` — historical context only, not current direction

---

## Preserved engineering and agent instructions

The files below contain useful engineering principles and repo operating instructions.
They also contain **legacy product framing** (video overlay, replay, check-in loop, leaderboard).
**Read their engineering rules. Ignore their product direction for the active `/axis` surface.**

@AGENTS.md
@AXIS_ENGINEERING_CONSTITUTION.md
