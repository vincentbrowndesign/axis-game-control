# Architecture

Existing Axis stack only:

- Next.js App Router: routes, server components, API routes, upload UI, replay UI.
- Clerk: authentication, user identity, session persistence.
- Supabase: structured persistence, storage, sessions, uploads, processing jobs, output JSON files.
- Trigger.dev: background orchestration for processing jobs.
- Roboflow/CV later: tracking and event extraction behind the same processing contract.

Current persistence objects:

- Game session: stored in `axis_sessions`.
- Upload record: stored in `axis_uploads`.
- Processing job: stored in `axis_processing_jobs`.
- Placeholder outputs: stored in Supabase Storage under the session output path.

Invariants:

- Do not add Prisma, Redis, Vercel Blob, or extra databases.
- API routes stay thin: authenticate, validate, persist, enqueue Trigger task, return.
- Trigger tasks own background status transitions.
- Frontend reads real backend session/job state.
- Upload/replay routes and UI are preserved unless the current unit explicitly requires a small seam fix.
- Roboflow/CV must write into the same output contract later.
