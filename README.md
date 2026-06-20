# Axis

Axis is a conversation product. The conversation itself is the product.

**Current MVP:** Axis Conversation — a single page where Axis helps the work develop through conversation.

## What Axis is today

A clean conversation interface. The user brings rough work. Axis helps it develop.

Axis is not an analytics dashboard, metrics dashboard, notebook, coach bot, tracker, analytics tool, or training system.

Axis Auth v0 supports signed-in, owner-scoped thread continuity. It is not profiles, organizations, billing, roles, memory, or analytics dashboard access.

Axis may use a Context Dashboard shell as current-thread presentation. That shell is not analytics, monitoring, metrics, Lens, evidence, media, memory, or Data Asset runtime.

Active route: `/` → `/axis`

## How to run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Where the active MVP lives

- Page: `src/app/axis/page.tsx`
- API: `src/app/api/axis/conversation/route.ts`

## What is intentionally out of scope today

- Voice
- Camera
- Upload
- Analytics dashboards
- Metrics dashboards
- Sidebars
- Cards
- Analytics
- Missions
- Game tracking
- Computer vision
- Long-term memory

These capabilities exist in the codebase as infrastructure. They are not active in the current MVP page.

## Current Axis Source of Truth

| Source | Purpose |
|---|---|
| `docs/AXIS_CONVERSATION_MVP.md` | MVP scope, product truth, acceptance tests, anti-patterns |
| `docs/REPO_CLEANUP.md` | What changed, what was archived, what to not touch |
| `src/app/axis/page.tsx` | Active page |
| `src/app/api/axis/conversation/route.ts` | Active conversation API |

Archived docs in `archive/*.legacy.md` are **historical context only** — they describe prior product directions (check-in loop, leaderboard, video overlay). They are not current truth.

## Legacy and infrastructure

Video, CV, replay, overlay, and tracking infrastructure lives in:
- `src/app/api/axis/` (all non-conversation API routes)
- `src/lib/` (axis-operating-system, axis-cv-overlay, etc.)
- `archive/` — archived product docs from prior directions
