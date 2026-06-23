# Axis Build Map

Status: ACTIVE

Purpose: Decide what gets built now, what stays hidden, and what must not compete with the current product truth.

## Current Build Thesis

Axis is a basketball session memory system.

The active product must prove:

```text
Open phone
-> sign in
-> start session
-> type / talk / tap moment
-> end session
-> memory exists
```

## Build Now

1. `/axis` mobile session shell
2. Axis Auth v0
3. Axis Session Memory
4. Session draft persistence through existing `/api/axis/sessions`
5. typed/tap moment capture
6. saved/local memory preview
7. Ask Axis placeholder over session memory
8. Tools placeholder with Build Map access

## Refine Current

1. mobile readability
2. one-hand session flow
3. local fallback when auth or persistence fails
4. last interpreted moment
5. correction controls
6. session completion and saved-to-memory state

## Active Foundations

1. Axis Data Asset Contract v0
2. Axis CV Foundation v0 as isolated visual reality processing

These foundations may inform future work, but they do not override the active session-memory product.

## Define Capsule

1. Operational Axis Data Asset Layer
2. Axis Asset Flywheel strategy
3. Board Object Layer beyond local prototypes
4. Evidence/Witness governance

## Do Not Build Yet

- new database schema
- Supabase migrations
- cross-thread player memory
- long-term player model
- automatic scouting reports
- verified evidence verdicts
- replay product
- overlay product
- upload-first product workflow
- sponsor tooling
- subscriptions
- analytics dashboards
- debug dashboards
- shot detection as product truth
- pass detection as product truth
- fake stats
- provider/model menus on the main UI

## Hidden But Preserved Infrastructure

Do not delete preserved backend routes or runtime infrastructure unless explicitly requested.

Preserved infrastructure may include:

- CV/video routes
- Mux/Cloudflare/Trigger-related routes
- OpenAI or model routes
- artifacts and exports
- Supabase auth and persistence helpers
- lab routes
- build-map/dev routes

Hidden does not mean removed. It means not shown as current user-facing product truth.

## Allowed Current Product Files

Current `/axis` refinement may touch:

```text
src/app/axis/page.tsx
src/components/axis/*
src/app/axis/axis-auth-control.tsx
src/app/api/axis/sessions/route.ts
src/lib/axis/client.ts
src/lib/axis/types.ts
docs/AXIS_BUILD_MAP.md
docs/AXIS_INDEX.md
docs/AXIS_PRODUCT_MAP.md
docs/AXIS_DESIGN_CONSTITUTION.md
docs/AXIS_MOBILE_PRIORITY.md
docs/capsules/AXIS_SESSION_MEMORY.md
docs/capsules/AXIS_AUTH.md
```

Only touch API/session helpers when the build ticket explicitly requires persistence behavior.

## Current Acceptance Test

Axis A1 passes when:

1. User can start a session on a phone.
2. User can capture typed/tap moments.
3. Axis shows the last interpreted moment.
4. User can correct or mark review.
5. User can end the session.
6. Session becomes saved/local memory.
7. Recent memory preview appears.
8. The loop works without camera, voice, or AI.
9. Debug/provider/model language stays off the main screen.

## What To Read First

Read `docs/AXIS_INDEX.md` first.
