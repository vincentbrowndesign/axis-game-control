# Axis Basketball Full-Body-First Cleanup Report

## Deleted files

- `src/components/BasketballCameraOverlay.tsx`
- `src/components/BasketballAIEventReview.tsx`
- `src/components/BasketballPlayerLookup.tsx`
- `src/components/AxisMeasureShell.tsx`
- `src/lib/axis-measure.ts`
- `src/lib/basketball/nba.ts`
- `src/app/api/basketball/overlays/save/route.ts`
- `src/app/api/basketball/overlays/[session_id]/route.ts`
- `src/app/api/basketball/ai/events/[id]/route.ts`
- `src/app/api/basketball/ai/events/[id]/review/route.ts`
- `src/app/api/basketball/clips/generate/route.ts`
- `src/app/api/basketball/recordings/create/route.ts`
- `src/app/api/basketball/recordings/complete/route.ts`
- `src/app/api/basketball/recordings/[session_id]/route.ts`
- `src/app/api/basketball/nba/player-search/route.ts`
- `src/app/api/basketball/nba/player/[id]/route.ts`
- `src/app/api/basketball/nba/player/[id]/stats/route.ts`
- `python/basketball/detect_video.py`
- `python/basketball/generate_clip.py`
- `python/basketball/overlay_event_candidates.py`
- `docs/BASKETBALL_AI_TAGGING_PLAN.md`
- `docs/BASKETBALL_API_INVENTORY.md`
- `docs/BASKETBALL_FRAME_EXTRACTION_PLAN.md`
- `docs/BASKETBALL_INSTALL_COMMANDS.md`
- `docs/BASKETBALL_OPEN_SOURCE_STACK.md`

## Rewritten files

- `src/lib/basketball.ts`
- `src/app/globals.css`
- `src/app/axis/basketball/page.tsx`
- `docs/BASKETBALL_ARCHITECTURE_PLAN.md`
- `docs/BASKETBALL_BUILD_GUARDRAILS.md`
- `docs/BASKETBALL_FINAL_SWEEP_REPORT.md`

## Removed UI sections

- court overlay setup
- court calibration
- tactical overlay mode picker
- suggested moment review panel
- clip creation controls
- NBA teaching lookup
- upload-first AxisMeasure shell

## Removed routes

- overlay save/get routes
- recording create/complete/list routes
- AI event read/review routes
- clip generation route
- NBA lookup routes

## Removed docs

- wrong AI tagging plan
- wrong API inventory
- wrong frame extraction plan
- wrong install command guide
- wrong open-source stack guide

## Kept files

- `src/components/AxisFullBodyTracker.tsx`
- `src/app/page.tsx`
- `src/app/api/basketball/sessions/create/route.ts`
- `src/lib/supabase-server.ts`
- `python/basketball/pose_analysis.py`
- `docs/BASKETBALL_ARCHITECTURE_PLAN.md`
- `docs/BASKETBALL_BUILD_GUARDRAILS.md`

## Known leftovers

- The original migration remains in history; a cleanup migration drops the wrong overlay/event/clip tables and creates body-first tables.
- The session API still uses the existing `basketball_sessions` table until body session persistence is built.
- Full-body context is currently localStorage only.

## Checks run

- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `python -m compileall python` passed.
- `npm run typecheck` was skipped because no script exists.
- `npm test` was skipped because no script exists.

## Errors fixed

- Removed stale generated `.next` route validators after deleting wrong API routes.

## Next safe step

- Add authenticated full-body session and pose sample persistence after the full-body tracker MVP is stable.
