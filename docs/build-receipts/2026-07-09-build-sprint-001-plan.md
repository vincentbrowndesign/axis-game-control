# Build Receipt — Build Sprint 001 Plan: Player Intelligence v0

Date: 2026-07-09
Agent: Claude
Type: Implementation plan (no code changed in this pass)

## What changed

A full implementation plan for Build Sprint 001: Player Intelligence v0, covering the
Axis Control Center, Build Sprint 001 page, Player Intelligence Session workflow,
First 10 Sessions tracker, and Report Draft workflow. No app code was modified.

## Why it changed

The Axis Brain (2026-07-09 sync) sets the current priority: launch Trophy Labs
Player Intelligence Sessions as a manual operating product with the formula
Proof + Plan + Next Objective, and complete the First 10 Player Intelligence
Sessions learning loop. The repo already contains uncommitted v0 scaffolding for
all three routes; this plan turns that scaffolding into a usable live-gym operator
tool without overbuilding AI, CV, sensors, or dashboards.

## State found in the repo

Already present (untracked, working v0 scaffolding):

- `src/app/axis/control-center/page.tsx` → `PlayerIntelligenceOperatingSystem mode="control"`
- `src/app/axis/build-sprint-001/page.tsx` → `mode="sprint"`
- `src/app/axis/player-intelligence-session/page.tsx` → `mode="session"`
- `src/components/axis/player-intelligence/PlayerIntelligenceOperatingSystem.tsx`
  (one ~780-line client component: all three modes + inline styles)
- `src/components/axis/player-intelligence/PlayerIntelligenceData.ts`
  (operating map, priorities, sprint tasks, capture checklist, empty tracker rows)
- Control Center is already first in the `AXIS_APPS` launcher in `AxisSuiteShell.tsx`
- Persistence: one localStorage key `axis-player-intelligence-v0` holding ONE
  global session (intake, permission, checklist, proof moments, report, offer)
  plus tracker rows and sprint checks

## Gaps the plan closes

1. Single-session state: running session #2 would overwrite session #1.
   Restructure to a multi-session store (`sessions: PlayerIntelligenceSession[]`).
2. First 10 tracker is buried inside the session page and requires double entry.
   Move it to Control Center and derive rows from session records (lesson editable).
3. Report Draft is a form with no deliverable. Add report text output
   (copy-to-clipboard + print view) following the Trophy Labs Player Intelligence
   Report structure.
4. Session page is one long scroll. Restage it as the live-gym flow:
   Intake → Permission → Capture Checklist → Proof Moments → Report Draft →
   Follow-Up + Debrief, with per-stage completeness and a session completeness
   meter mapped to the First 10 success standard.
5. No revenue-note / lesson capture. Add a Debrief stage matching the First 10
   Revenue Note template (paid amount, parent feedback, what created trust,
   what confused, best proof clip, lesson, Axis improvement).
6. Data-loss risk on iPad Safari. Add JSON backup export/import on Control Center
   until Supabase persistence ships.

## Files that matter (planned)

- `src/lib/axis/player-intelligence.ts` — NEW: types, empty states, storage
  load/save with v0→v1 migration, completeness calculators, report text formatter.
- `src/components/axis/player-intelligence/PlayerIntelligenceData.ts` — keep;
  add stage definitions and success-standard checklist items.
- `src/components/axis/player-intelligence/` — split the monolith:
  `PlayerIntelligenceOperatingSystem.tsx` (mode router + shared chrome),
  `ControlCenter.tsx`, `SprintBoard.tsx`, `SessionWorkflow.tsx`,
  `FirstTenTracker.tsx`, `PiKit.tsx` (Field/Switch/FormCard/styles).
- Route pages unchanged: `control-center`, `build-sprint-001`,
  `player-intelligence-session` (session selected via `?session=<id>` param).

## What Codex should do next (build order)

1. Create `src/lib/axis/player-intelligence.ts` (types + store + migration).
2. Extract `PiKit.tsx` shared primitives and styles from the monolith.
3. Build `SessionWorkflow.tsx` staged flow on the multi-session store,
   including session list / start-new entry and permission banner on capture.
4. Build report formatter + Copy Report + print view.
5. Add Debrief stage (revenue note fields).
6. Build `FirstTenTracker.tsx` derived from sessions; mount in Control Center.
7. Wire sprint board task links; add backup export/import to Control Center.
8. Verify: `npx tsc --noEmit`, `npm run build` (retry with
   `NODE_OPTIONS=--max-old-space-size=6144` on transient OOM), lint changed files,
   manual pass at iPad viewport (~1024px, touch targets ≥ 44px).

## What still needs persistence / backend work

- Supabase persistence is deliberately NOT in this sprint. Next build:
  `axis_pi_sessions` table (`id uuid`, `session_number int`, `status text`,
  `payload jsonb`, timestamps), RLS enabled with no policies, accessed only
  through service-role API routes (`/api/axis/player-intelligence/sessions`),
  mirroring the `axis_event_containers` + `axis-event-container-server.ts` pattern.
  localStorage becomes the offline cache, Supabase the source of truth.
- No auth gate exists on `/axis` routes today; unchanged by this sprint. Revisit
  when minor-athlete session data moves to Supabase (private first).

## Risks

- localStorage eviction on iPad Safari can lose paid-session notes before the
  Supabase build; the JSON backup control is the interim mitigation.
- Minor-athlete data sits in browser storage on the operator device; keep the
  device private, and prioritize the persistence build.
- The v0→v1 storage migration must import any real data already typed into the
  current scaffolding key (`axis-player-intelligence-v0`) as session #1.

## Boundaries respected

No AI, no CV, no sensors, no LiDAR, no dashboards, no fake metrics, no new
routes beyond the three that already exist, no changes to `/axis` home, camera
loop, or event-container flows. Language rules: development read / development
priority / next objective; no diagnosis or medical claims. Private first.
