# Axis A1 Architecture

Status: ACTIVE DEVELOPMENT GUIDANCE

Development guidance only. Do not import into the app, expose through a route, copy into UI, or place in `public`.

## Current Active Release

Axis A1.2 - Camera + Player Lock + Open Command Toolbar.

## Core Product Model

```text
Camera = Axis sees.
SDKs/APIs = Axis speaks visually.
Toolbar = user speaks back.
Evidence = what Axis saves.
Memory = what Axis compounds.
```

## Current Active Loop

```text
camera opens
-> player box locks onto athlete
-> user types anything into the open command toolbar
-> command becomes an action, note, question, or saved read
-> local metadata is saved
```

Hard rule: no toolbar submit is empty, no text is invalid. Every submit becomes a contextual action, a tool command, a coach note, a correction note, or a pending question.

## File Map

| Concern | File |
|---|---|
| Feature flags | `src/axis/core/feature-flags.ts` |
| Capability registry | `src/axis/core/capability-registry.ts` |
| Release manifest | `src/axis/core/release-manifest.ts` |
| Core types (`AxisVisionRead`, `AxisEvidence`, `AxisDetectedObject`, ...) | `src/axis/core/types.ts` |
| Command types | `src/axis/query/axis-command-types.ts` |
| Open command parser | `src/axis/query/open-command-parser.ts` |
| Command metadata store | `src/axis/query/axis-command-store.ts` |
| Open command toolbar UI | `src/axis/query/query-toolbar.tsx` |
| Camera source (getUserMedia, front/rear/flip) | `src/axis/camera/camera-source.ts` |
| Evidence store (metadata only, no media blobs) | `src/axis/evidence/evidence-store.ts` |
| Session object store | `src/axis/session/session-store.ts` |
| Player read normalizer | `src/axis/vision/player-read-normalizer.ts` |
| Camera overlay renderer (player box states) | `src/axis/vision/overlay-renderer.ts` |
| Camera + toolbar composition | `src/components/axis/AxisSessionCamera.tsx` |
| Outer session shell (start/end session, sign-in) | `src/components/axis/AxisShell.tsx` |
| Active route | `src/app/axis/page.tsx` |
| Debug capability/release viewer | `src/app/axis/lab/page.tsx` |

## Active Feature Flags

`axis.camera`, `axis.playerLock`, `axis.openCommandToolbar`, `axis.localEvidence` are `true`.

## Inactive Future Flags

`axis.movementChains`, `axis.clips`, `axis.memoryPages`, `axis.aiAgent`, `axis.ballDetection`, `axis.rimCalibration`, `axis.huggingFaceObjects`, `axis.supabaseMemory`, `axis.proofClipExport` are `false`.

## latestPlayerRead: Single Source of Truth

`AxisSessionCamera` holds one `latestPlayerReadRef: AxisVisionRead | null`. It drives:

- player box position and style on the overlay canvas
- save behavior (`save this` / empty submit while locked)
- export behavior (export uses the current read, or creates one first)
- note/question attachment (`attachedToReadId`)
- command context passed into the parser (`lockState`)

There is no second status label, chip, or duplicate state. The player box alone communicates state:

- `searching`: no box
- `review`: faint dashed box
- `locked`: solid white box
- `saved`: green box flash for ~850ms after a save
- `lost`: faded dashed box

## Open Command Parser Contract

Every call to `parseAxisOpenCommand(raw, context)` returns an `AxisCommand`. It never returns `null` and never throws. Unknown text always becomes a `note` (`coach_note`, `correction`, `intent`, or `question` if it ends in `?`).

Empty submit resolves contextually: camera not ready -> open camera, player locked/review -> save read, no read/searching -> check player.

## Evidence Rules

`src/axis/evidence/evidence-store.ts` persists only small metadata (ids, lock/review state, normalized box coordinates, command text, notes) to `localStorage`. It never stores blobs, base64, screenshots, or video frames, and it catches quota errors without crashing the UI.

## Future Capability Scaffolds (inactive)

- `src/axis/biomechanics/movement-chain-types.ts` - foot/ankle/knee/hip/trunk chain from the player box.
- `src/axis/clips/clip-types.ts` - export frame/clip from a saved read, with overlay attached.
- `src/axis/memory/memory-types.ts` - evidence -> session object -> memory page promotion.
- `src/axis/agent/agent-tool-types.ts` - chatbox -> tool router -> tools -> evidence -> memory.

None of these are wired into UI. They exist so the next capability plugs into an already-agreed shape instead of a new screen.
