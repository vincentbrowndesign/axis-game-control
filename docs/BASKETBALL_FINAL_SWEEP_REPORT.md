# Axis Basketball Final Sweep Report

Sweep date: 2026-06-29

## Files inspected

- `docs/BASKETBALL_BUILD_GUARDRAILS.md`
- `docs/BASKETBALL_ARCHITECTURE_PLAN.md`
- `docs/BASKETBALL_API_INVENTORY.md`
- `docs/BASKETBALL_FRAME_EXTRACTION_PLAN.md`
- `docs/BASKETBALL_AI_TAGGING_PLAN.md`
- `src/app/page.tsx`
- `src/app/axis/basketball/page.tsx`
- `src/app/api/basketball/**`
- `src/components/BasketballCameraOverlay.tsx`
- `src/components/BasketballAIEventReview.tsx`
- `src/components/BasketballPlayerLookup.tsx`
- `src/lib/basketball.ts`
- `src/lib/basketball/nba.ts`
- `src/lib/supabase-server.ts`
- `python/basketball/*.py`
- `supabase/migrations/20260629101722_axis_basketball_core.sql`

## Issues found

- Root basketball screen had later workflow panels stacked directly under the camera-first MVP.
- Coach-facing copy still used internal language like AI candidates.
- Clip generation accepted reviewed-event-shaped data without checking review status.
- Server-side Supabase helper could write with service role using client-provided `userId` before auth is wired.
- Empty duplicate route directory existed at `src/app/api/basketball/ai/events/[session_id]`.

## Issues fixed

- Collapsed recording, suggested moment review, and teaching reference behind disclosure sections.
- Replaced coach-facing AI candidate language with suggested moment language.
- Replaced exposed overlay config id wording with Overlay setup wording.
- Added reviewed-event status gate for clip generation.
- Disabled basketball server writes unless explicitly enabled with `AXIS_BASKETBALL_ENABLE_SERVER_WRITES=true`.
- Removed the empty duplicate AI route directory.

## Issues intentionally left for later

- Supabase persistence requires auth and applied migrations.
- Recording remains local/temporary until storage is wired.
- AI analysis requires worker orchestration and stored recordings.
- Clip generation requires a server-accessible source video path.
- NBA data is a teaching reference layer, not part of the camera-first MVP.

## Duplicate files removed

- Removed empty duplicate route directory:
  `src/app/api/basketball/ai/events/[session_id]`

## UI language cleaned

- `AI candidates` -> `suggested moments`
- `candidate` in user-facing empty states -> `suggested moment`
- `Overlay context: <id>` -> `Overlay setup: saved for this recording`
- Raw review statuses are now shown as coach-facing labels.

## Build/test results

- `npx tsc --noEmit` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `python -m compileall python` passed.
- `/axis/basketball` returned `200 OK` on the local dev server.

## Known limitations

- The current UI is honest but mostly local-first.
- The dashboard is an organized empty-state board, not a live analytics dashboard.
- Python workers compile but require their runtime packages for real video analysis.

## Next safe step

- Wire authenticated persistence before enabling server writes or production database mutation.
