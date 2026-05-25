# Code Standards

- Use strict TypeScript.
- Avoid `any`.
- Use `use client` only when browser interactivity is required.
- Server components fetch data directly.
- API routes authenticate, validate input, update Supabase, and enqueue background work.
- Do not run heavy processing directly inside API routes.
- Trigger.dev tasks should be narrow and export one task per task file.
- Supabase queries should select only needed fields where practical.
- Keep edits scoped to the current unit.
- Preserve existing app structure, routes, and UI unless directly required by the unit.
- Do not introduce new infrastructure without explicit approval.
