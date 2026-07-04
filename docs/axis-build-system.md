# Axis Build System

Status: ACTIVE DEVELOPMENT GUIDANCE

This document is for coding agents and maintainers. It must not be imported into the app, exposed through a route, copied into UI, or placed in `public`.

## Purpose

Axis needs one stable build system so every capability strengthens the same product instead of becoming a new dashboard, screen, panel, or fake feature.

## Build Law

```text
Vision detects.
AI interprets.
User corrects.
Axis remembers.
```

## Stable Architecture

Every capability plugs into the same update path:

```text
Input Source
-> Signal Adapter
-> Capability Run
-> AxisEvidence
-> AxisSessionObject
-> AxisMemoryPage
```

## One Product Loop

```text
Open Axis
-> Start Session
-> Camera opens
-> player box locks onto athlete
-> user types anything into the open command toolbar
-> command becomes an action, note, question, or saved read
-> local metadata is saved
-> End Session
-> Review / export later
```

Axis must still work when camera, mic, AI vision, internet, or a provider fails. No toolbar submit is ever empty or invalid.

## What Belongs In Main UI

- Start Session
- AXIS / player / session label
- Camera surface with player box overlay
- Single open command toolbar
- Export control
- End Session

## What Belongs In Axis Lab

- SDK names
- API health
- provider status
- raw detections
- raw track IDs
- confidence tables
- FPS
- JSON
- model names
- debug state

## Hard Bans

- new screen for every SDK or API
- dashboard cards
- required landmark walls
- permanent test category rows
- fake coaching
- fake scores
- training plans
- generic AI product copy
- client-side server tokens

## Development Files

Agent files are build guidance only:

- `AGENTS.md`
- `CLAUDE.md`
- `CODEX.md`
- `src/axis/AGENTS.md`
- `src/axis/vision/AGENTS.md`
- `src/app/axis/AGENTS.md`

They must not appear in production build output.
