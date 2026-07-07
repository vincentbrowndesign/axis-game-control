# Axis Product Architecture v0.1

Locked 2026-07-07 for the July 20 public link. This document is the product
design lock: build inside it, do not renegotiate it per screen.

## Identity

- **Company:** Trophy Labs
- **Product:** Axis
- **Category:** Basketball performance intelligence
- **Core object:** Event
- **Main job:** turn a basketball event into film, proof, reports, access, and player memory

One-liner: Trophy Labs builds Axis. Axis turns basketball events into film,
proof, reports, access, and player memory.

## User surfaces

| Surface | Route | Who it is for | What it does |
|---|---|---|---|
| Public Site | `/` | Parents, coaches, programs, sponsors | Sells and explains Axis. No operator machinery. |
| Operator App | `/axis` | The coach/operator running events | Start, resume, and run events. The command center. |
| Customer Portal | (future — access links today) | Parents, players, teams | Receives replays, reports, clip packs via access links. |
| Axis Lab | `/axis/lab` | Trophy Labs internal | Experiments: calibrate, CV, pose, AI, raw analysis, debug, future modules. |

Public visitors never land in the raw operator app. The operator never needs
the lab to run an event.

## Event states

```text
Draft -> Live -> Review -> Packaged -> Ready
```

- **Draft** — event exists; source, media, players being set up.
- **Live** — clock running; KEEP/FIX marking in progress.
- **Review** — marking done; moments being tagged (shown to users as "Moments").
- **Packaged** — report built and access attached.
- **Ready** — saved to memory; shareable and sellable.

Database statuses map onto these states; the UI speaks states, never raw
statuses.

## Main actions

```text
Start -> Mark -> Tag -> Package -> Share
```

- **Start** — create the event, pick the source.
- **Mark** — KEEP (asset) / FIX (coaching) with a timestamp.
- **Tag** — attach player, lens, outcome, output to each moment.
- **Package** — build the report and attach access.
- **Share** — send the access link; the event lives on as memory.

## Language

Use: Moments, Tag moments, Build package, Save to memory, Go live, Field mode.

Avoid in user-facing UI: review (as a noun for the screen), module, provider,
API, SDK, model names, debug, pipeline, worker, schema.

## Visual rules

- One primary action per screen.
- Lime (`#9dff45`) only for primary actions, success, and KEEP.
- Red-orange (`#ff5c39`) only for FIX, corrections, and live signal.
- Less all-caps in body text; uppercase is for brand, labels, and buttons.
- No dense module grids on first screens. No invisible low-contrast text.
- Mobile-first spacing and touch targets.

## Rule: hide the machinery

The main UI never shows: SDKs, APIs, providers, model names, raw detections,
debug panels, database language, or future-capability grids. Machinery lives
in Axis Lab or in code. A coach should run an entire event without ever
learning how Axis works inside.
