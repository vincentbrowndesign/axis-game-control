# Architecture

Existing Axis stack only:

- Next.js App Router: routes, server components, API routes, public entry, check-in, Axis History, and future replay surfaces.
- Clerk: identity continuity, sign in, sign up, session persistence, and user ownership.
- Supabase: persistent history layer for check-ins, streaks, sessions, training logs, uploads, and future replay objects.
- Trigger.dev: progression and background processing for durable work that should survive refreshes and reconnects.
- Mux: future replay/media layer for video delivery, playback, and stream sessions.
- Roboflow/CV: future intelligence layer for visual understanding and replay telemetry.

Current continuity seam:

identity -> physical presence -> history persistence

Current persistence objects:

- Clerk user identity.
- Supabase attendance/check-in records.
- Supabase training log metadata.
- Streak and history summaries derived from persisted records.

Future media objects:

- Game sessions.
- Replay assets.
- Clips.
- Stats.
- Broadcast assets.

Invariants:

- Do not add Prisma, Redis, Vercel Blob, or extra databases.
- API routes stay thin: authenticate, validate, persist, enqueue background work when needed, return.
- Frontend reads real backend state for identity and history.
- Replay is future infrastructure until the identity, presence, and history loop is stable.
- Roboflow/CV must remain hidden infrastructure behind stable product loops later.
