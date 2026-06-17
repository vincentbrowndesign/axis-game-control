# Axis

Axis is a conversation product. The conversation itself is the product.

**Current MVP:** Axis Conversation — a single page where Axis helps the work develop through conversation.

## What Axis is today

A clean conversation interface. The user brings rough work. Axis helps it develop.

Axis is not a dashboard, notebook, coach bot, tracker, analytics tool, or training system.

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
- Dashboard
- Sidebars
- Cards
- Analytics
- Missions
- Game tracking
- Computer vision
- Long-term memory

These capabilities exist in the codebase as infrastructure. They are not active in the current MVP page.

## Documentation

- `docs/AXIS_CONVERSATION_MVP.md` — MVP scope, product truth, acceptance tests
- `docs/REPO_CLEANUP.md` — what changed, what was archived, what remains

## Legacy and infrastructure

Video, CV, replay, overlay, and tracking infrastructure lives in:
- `src/app/api/axis/` (all non-conversation API routes)
- `src/lib/` (axis-operating-system, axis-cv-overlay, etc.)
- `archive/` — archived product docs from prior directions
