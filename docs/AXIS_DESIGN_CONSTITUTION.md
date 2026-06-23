# Axis Design Constitution

Status: ACTIVE

Purpose: Define the user-facing design rules for the current Axis product.

## Design Truth

Axis should feel like a live basketball session turning into memory.

Visual direction:

- dark athletic session UI
- mobile-first
- calm under pressure
- structured but not dashboard-like
- one-hand usable
- memory-first

## Primary User Story

The user should be able to:

```text
open Axis
-> start a session
-> type / talk / tap what happened
-> see the last interpreted moment
-> correct it if needed
-> end the session
-> see saved memory
```

## Main Screen Rules

Show:

- Axis identity
- auth/session state
- Start Session
- player / players
- focus
- session type
- active timer
- natural input
- last interpreted moment
- correction controls
- saved memory preview
- bottom navigation

Hide by default:

- APIs
- routers
- model names
- raw detections
- raw track IDs
- confidence percentages
- FPS
- frame counts
- JSON
- rim setup
- zones
- calibration
- debug controls

## Component Language

Use:

- Session Card
- Moment Card
- Memory Preview
- Correction Chips
- Next Session Card
- Tools
- Ask Axis

Avoid:

- router event
- inference output
- detection stream
- classification confidence
- pipeline result
- JSON object
- frame analysis

## Color Rules

Color communicates state, not decoration.

- orange: active session and primary action
- green/mint: saved or ready
- amber: needs review
- red: destructive or failed
- blue/cool accent: evidence or source attachments when active
- neutral dark glass: structure and background

## Screen Placement Rule

If it helps the user capture or review the session, it can be user-facing.

If it configures a capability, it belongs in Tools.

If it is experimental or diagnostic, it belongs in Axis Lab.

If it only helps developers, it belongs in developer docs or build-map context.

## Source Merge Note

This active design constitution replaces the active-source role previously held by `docs/AXIS_UI_VISUAL_LANGUAGE.md`.

The full visual-language source is preserved in `docs/reference/AXIS_UI_VISUAL_LANGUAGE.md`.
