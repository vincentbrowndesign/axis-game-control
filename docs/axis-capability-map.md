# Axis Capability Map

Status: ACTIVE DEVELOPMENT GUIDANCE

Runtime capability data lives in `src/axis/core/capability-registry.ts`.

## Capability Architecture

Every capability has:

- id
- name
- status
- release
- input signals
- output objects
- main UI visibility
- lab visibility
- summary

## Status Values

- `active`: usable in the current product loop
- `available`: implemented but not default
- `planned`: not wired into the active path
- `deprecated`: preserved only for migration or reference
- `disabled`: behind a flag or unavailable

## Active Capability Rules

Active capabilities must:

- produce `AxisEvidence`
- avoid provider-specific UI
- avoid fake certainty
- degrade when camera, mic, AI, or internet fails
- keep debug in `/axis/lab`

## Current Map

| Capability | Status | Notes |
|---|---|---|
| `session-memory` | active | Core product memory loop. |
| `camera.browser` | active | Browser camera evidence. |
| `pose.mediapipe` | active when needed | Pose evidence, not product copy. |
| `measurement.local` | active when needed | Real local measurements only. |
| `proof.export.png` | active when needed | Local proof frame evidence. |
| `objects.huggingface` | planned | Server-side only, no per-frame calls. |
| `roboflow` | deprecated | Not active. |

## UI Boundary

Main UI shows only: the AXIS / player / session label, the camera surface with player box overlay, the single open command toolbar, and the export control.

Main UI must never show Mark Moment, Analyze, Last Moment, Correct / Not Right, dashboard cards, ball or rim, provider names, model names, raw detections, JSON, FPS, route names, or health checks.
