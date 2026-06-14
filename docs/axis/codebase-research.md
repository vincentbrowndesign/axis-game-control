# Axis Codebase Research

## Architecture in One Page

```
Video
→ Detection
→ Tracking
→ Overlay
→ Export
```

Underneath that pipeline:

```
Identity → Presence → Participation → Progression → History → Leaderboard → Return
```

Intelligence sits below both:

```
Experiment → Claim → Verdict → Observation → Outcome
```

---

## Stack

| Layer       | Technology                          |
|-------------|--------------------------------------|
| Framework   | Next.js (App Router)                 |
| Auth        | Supabase                             |
| Storage     | Supabase + Cloudflare Stream         |
| Background  | Trigger.dev                          |
| CV          | RF-DETR Nano + Supervision + ByteTrack (Python, `tracking/`) |
| Overlay     | Canvas + CSS                         |
| Intelligence| axis-core vocabulary layer           |

---

## Key File Map

### Intelligence Layer (new — frozen vocabulary)
```
src/lib/axis-core.ts              — shared types. Zero imports.
src/lib/witness-registry.ts       — what can observe reality
src/lib/experiment-registry.ts    — what can test reality
src/lib/learning-engine.ts        — Verdict → OutcomeSignal
```

### Product Shell
```
src/app/axis/mission/page.tsx     — primary shell. ShellPhase state machine.
src/lib/axis-challenges.ts        — AXIS_CHALLENGES + VISION_CHALLENGES
src/lib/axis-expansion.ts         — static intent expansion (offline fallback)
src/app/api/axis/expand/route.ts  — LLM expansion endpoint (gpt-4o-mini)
```

### Camera + CV
```
tracking/                         — Python CV service (RF-DETR + ByteTrack)
src/lib/axis-tracking.ts          — TypeScript types for tracking events
src/lib/axis-camera-foundation.ts — camera stream setup
src/lib/axis-cv-overlay.ts        — overlay rendering
```

### Film + Export
```
src/lib/axis-video-jobs.ts        — video job management
src/lib/axis-replay-engine.ts     — replay state
src/lib/axis-replay-renderer.ts   — canvas rendering
src/lib/axis-ffmpeg.ts            — ffmpeg integration
trigger/axis-video-processing.ts  — Trigger.dev job (11 stages)
src/lib/cloudflare-stream.ts      — Mux/Cloudflare upload
```

### State + Auth
```
src/lib/axis-persistence.ts       — localStorage + session lifecycle
src/lib/axis-evidence.ts          — EvidenceKind types
src/lib/axis-client-auth.ts       — client auth
src/lib/axis-request-auth.ts      — server auth
src/lib/axis-supabase-server.ts   — server Supabase client
```

### API Routes
```
src/app/api/axis/expand/          — intent expansion (LLM)
src/app/api/axis/tracks/          — tracking events
src/app/api/axis/video-jobs/      — video job CRUD
src/app/api/axis/exports/         — export pipeline
src/app/api/axis/artifacts/       — artifact storage
src/app/api/axis/facts/           — fact storage
src/app/api/axis/mission-memory/  — mission memory
src/app/api/axis/ball/process/    — ball detection
src/app/api/axis/video-upload-url/ — upload URL generation
src/app/api/cloudflare/           — stream webhooks
src/app/api/roboflow/             — person detection
```

---

## Shell Phase State Machine

```
CONTEXT → THINKING → EXPAND → CHALLENGE → DONE
```

- `CONTEXT` — athlete types intent
- `THINKING` — three-dot wave, async processing
- `EXPAND` — clarifying question (max 1)
- `CHALLENGE` — active constraint displayed
- `DONE` — observation prompt, ready for next intent

---

## Intelligence Layer Rules

- `axis-core.ts` is frozen. Do not add types without approval.
- `learning-engine.ts` must not know about cameras, basketball, or AI providers.
- `witness-registry.ts` owns the `canWitness()` gate.
- `experiment-registry.ts` owns `canRun()` — do not bypass.
- `WitnessDimension` is an open string. Cartridges narrow locally.

---

## CV Boundary

The Python tracking service (`tracking/`) owns:
- bounding boxes
- confidence scores
- track IDs (session-scoped, visual continuity only)

It does NOT own:
- athlete identity
- roster
- calibration
- jersey matching

Identity assignment is manual coach calibration, not automatic.

---

## What Has Never Been Built (Do Not Build)

- Dashboards
- Scouting analytics
- Tactical overlays
- Assistant chat UI
- Coaching claims
- Clip-editing tools
- AI announcement surfaces
- Rep counting UI (removed in V6)
