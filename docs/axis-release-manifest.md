# Axis Release Manifest

Status: ACTIVE DEVELOPMENT GUIDANCE

This document is for maintainers and coding agents. Runtime release data lives in `src/axis/core/release-manifest.ts`.

## Release Path

| Release | Name | Rule |
|---|---|---|
| A1.0 | Camera shell | Camera opens, evidence can be captured without becoming mandatory. |
| A1.1 | Player lock | Local player detection normalizes into `AxisVisionRead`, avoid fake certainty. |
| A1.2 | Open command toolbar | Every toolbar submit resolves to an action, note, question, or saved read. |
| A1.3 | Movement chains | Foot / ankle / knee / hip / trunk chain evidence from the locked player box. |
| A1.4 | Clips | Saved reads can export a frame/clip with overlay attached. |
| A1.5 | Memory | Evidence promotes into session objects and memory pages. |
| A1.6 | AI video agent | Chatbox routes to tools, tools produce evidence, evidence becomes memory. |

Current active release is A1.2 - Open Command Toolbar.

## Discipline

Do not skip ahead.

Do not add a new product surface for each release.

Each release must strengthen:

```text
Start Session
-> Camera opens
-> player box locks
-> open command toolbar
-> Save Memory
```

## Current Provider Boundary

- MediaPipe may support pose when pose is needed.
- Hugging Face is the planned server-side object detection provider.
- Roboflow is deprecated and not part of the active path.

## Completion Standard

Before a release is called stable:

- outputs are shaped as `AxisEvidence`
- useful objects are shaped as `AxisSessionObject`
- memory pages remain searchable
- debug stays in `/axis/lab`
- no secrets are exposed
- typecheck passes
- build passes
