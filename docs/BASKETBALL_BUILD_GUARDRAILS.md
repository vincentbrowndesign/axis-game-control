# Axis Basketball Build Guardrails

Purpose:
This document protects the Axis Basketball build from hallucination, clutter, duplicate files, fake progress, noisy UI, and premature overbuilding.

## 1. Product Truth

Axis Basketball is:

```text
camera-first
overlay-first
AI-tagging-later
coach-review-after-AI
```

The correct sequence is:

```text
camera
-> overlay
-> overlay calibration
-> recording with overlay context
-> AI analyzes video + overlay
-> AI creates event candidates
-> coach reviews AI output
-> clips/reports later
```

Do not change this order unless the user explicitly asks.

## 2. Do Not Build Yet

Do not build these first:

- video upload
- manual live tagging buttons
- coach tag panels
- automatic stat claims
- make/miss automation
- full player identity
- reports
- clip generation
- dashboards full of fake data
- complex analytics
- custom AI models
- ShotTracker integration
- Mux integration
- Deepgram/ElevenLabs voice loops

These may exist as future notes only.

## 3. No Hallucination Rules

Before creating or editing code:

1. Inspect the existing project structure.
2. Reuse existing patterns, components, routes, auth helpers, Supabase clients, and styling conventions.
3. Do not invent files, routes, components, or libraries that do not fit the repo.
4. Do not claim a feature is working unless it is actually wired.
5. Do not say "AI detects" unless there is real AI code.
6. Do not say "saved" unless data is actually persisted.
7. Do not say "recorded" unless MediaRecorder or storage behavior exists.
8. If uncertain, write a TODO or limitation instead of pretending.
9. Keep mocks clearly labeled as mocks.
10. Keep future capabilities clearly labeled as future.

Use this wording when needed:

```text
Not implemented yet.
Placeholder only.
Future phase.
Mock data.
Requires real camera permission.
Requires recording/storage wiring.
Requires AI worker later.
```

## 4. No Clutter Rules

Keep the build clean.

Do not create:

- duplicate docs explaining the same thing
- multiple versions of the same component
- unnecessary helper files
- giant dashboards
- noisy cards
- too many buttons
- fake stat sections
- fake AI insights
- unused routes
- unused tables
- unused packages
- decorative UI that does not help the coach

Every file must answer:

```text
What product step does this serve?
Is it needed now?
Can it be simpler?
```

## 5. UI Rules

Axis Basketball UI should feel like a sideline tool, not a SaaS analytics wall.

Rules:

- mobile-first
- iPhone/iPad first
- big tap targets
- minimal text
- dark/simple camera-first layout
- organized empty states
- no crowded dashboards
- no fake activity feeds
- no fake "insights"
- no stat cards until real data exists

The first useful screen should be:

```text
Start Session
Open Camera
Choose Overlay
Calibrate Overlay
Save Overlay
```

## 6. Data Rules

Database work must support the build order.

Required early data:

- sessions
- overlay presets
- overlay configs
- overlay calibration
- recordings later

AI/event tables are allowed only as future-ready structure.

Do not make manual tagging the center of the schema.

AI event candidates should come later from:

```text
recording + overlay_config + detections + AI reasoning
```

## 7. Overlay Rules

The overlay is not decoration.

The overlay is the basketball context map for AI.

Overlay configs should store:

- overlay type
- opacity
- transform
- calibration
- settings
- session id
- user id

Overlays should support:

- court zones
- Delta offense
- shot chart
- spacing shapes

Do not overbuild the overlay with complex animation or analytics first.

## 8. Implementation Rules

For every build step:

1. Make the smallest useful version.
2. Keep the file count low.
3. Prefer one clean component over many fragments.
4. Prefer existing project style over new styling systems.
5. Do not install new packages unless required.
6. Keep auth and RLS respected.
7. Do not allow signed-out writes.
8. Add clear empty/error/loading states.
9. Do not break existing Axis routes.
10. Return a short summary of what changed.

## 9. Response Format After Each Build Prompt

After executing a prompt, respond with:

```text
Built:
- ...

Changed files:
- ...

Not built yet:
- ...

Known limitations:
- ...

Next safe step:
- ...
```

Do not give a long essay.
Do not claim future work is complete.
Do not hide limitations.

## 10. Final Guardrail

If a prompt asks for something that conflicts with this document, follow this document first and explain the conflict briefly.

Axis Basketball must stay:

```text
simple
real
camera-first
overlay-first
low-noise
no fake AI
no manual tagging first
```
