# Architecture

Use the existing Axis stack only.

## Stack Roles

- Next.js App Router: public entry, authenticated ritual surface, check-in, Axis History, and API routes.
- Clerk: identity continuity.
- Supabase: persistent history layer for check-ins, streaks, sessions, and future history objects.
- Trigger.dev: future progression/background processing when work must survive refreshes or reconnects.
- Mux: inactive future media boundary.
- Roboflow/CV: inactive future vision boundary.

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
