# Architecture

Use the existing Axis stack only.

## Stack Roles

- Next.js App Router: public entry, authenticated ritual surface, check-in, Axis History, and API routes.
- Clerk: identity continuity.
- Supabase: persistent history layer for check-ins, streaks, sessions, and future history objects.
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

Long term, replay becomes visual proof of accumulated effort history. It is not
the front door.

## Active Data Flow

sign in -> check in -> persist record -> derive streak/history -> return tomorrow

## Current Persistence

- Clerk user identity.
- Supabase check-in records.
- Supabase training log metadata.
- Derived streak and last check-in state.

## Invariants

- Do not add Prisma, Redis, Vercel Blob, or extra databases.
- Do not build new backend systems unless the current seam requires it.
- API routes stay thin: authenticate, validate, persist, return.
- The frontend reads real persisted state for identity and history.
- Media delivery and vision work are inactive until the current loop is stable.
- Intelligence remains hidden infrastructure, not visible product identity.
