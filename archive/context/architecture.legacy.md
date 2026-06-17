# Architecture

Use the existing Axis stack only.

## Stack Roles

- Next.js App Router: public entry, authenticated participation surface, check-in/check-out, progression, Axis History, leaderboard, organization worlds, and API routes.
- Clerk: identity continuity.
- Supabase: persistent continuity layer for check-ins, check-outs, completed effort hours, streaks, sessions, organization membership, leaderboard inputs, and future history objects.
- Trigger.dev: future progression/background processing when work must survive refreshes or reconnects.
- Mux: dormant future media boundary for replay/media delivery.
- Roboflow/CV: inactive future vision boundary.

## Dormant Replay / Media Boundary

Replay and media infrastructure must remain preserved but inactive in the
product surface.

Keep backend foundations for:

- Mux.
- Upload APIs.
- Session storage.
- Media persistence.
- Timeline systems.
- Replay pipelines.
- Trigger orchestration.
- Video infrastructure.

Do not expose replay-first navigation, upload-era dashboards, speculative
telemetry, tactical overlays, or AI media systems in the active member and
organization experience.

Long term, replay becomes visual proof of accumulated effort history. It is not the front door and must not redefine the current product.

## Active Data Flow

sign in -> participate -> persist record -> derive progression/history/leaderboard -> return tomorrow

## Current Persistence

- Clerk user identity.
- Supabase organization membership.
- Supabase check-in and check-out records.
- Supabase session and reflection metadata.
- Derived effort hours, streak, history, leaderboard, and organization activity state.

## Invariants

- Do not add Prisma, Redis, Vercel Blob, or extra databases.
- Do not build new backend systems unless the current seam requires it.
- API routes stay thin: authenticate, validate, persist, return.
- The frontend reads real persisted state for identity and history.
- Media delivery and vision work are inactive until the current loop is stable.
- Intelligence remains hidden infrastructure, not visible product identity.
- Future work should bias toward refinement, reliability, mobile usability, operational trust, and clear participation semantics.
