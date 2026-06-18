# Axis Capability Index

Purpose:
This index controls which capability capsules are active, which are future, and which must not drive the MVP.

## Active MVP Capsules

| Capsule | Status | Build Decision | Notes |
|---|---|---|---|
| Axis Conversation Layer | Active | Build Now | Text-first surface. Organizes rough input before asking. |
| Axis Understanding Primitives | Active | Build Now | Observation, Pattern, Relationship, Question, Hypothesis, Intervention, Outcome. |
| Axis Thread Board | Active | Refine Current | Inline comprehension view of the current thread. Not a separate screen. |

## Refine Current

| Capsule / Area | Status | Build Decision | Notes |
|---|---|---|---|
| `/axis` page | Active MVP surface | Refine Current | Must become gym-readable and one-flow. |
| `/api/axis/conversation` | Active API | Refine Current | Returns reply + threadBoard. |
| Thread Board rendering | Active renderer | Refine Current | Must be compact, sanitized, readable, and non-dashboard. |

## Future / Hold Capsules

| Capsule | Status | Build Decision | Notes |
|---|---|---|---|
| Axis Whiteboard Renderer | Future | Future Layer | Renderer only. Not the product. Not active MVP. |
| Axis Whiteboard Renderer / Board Object Layer | Future | Define Capsule | Defined in `docs/capsules/AXIS_BOARD_OBJECT_LAYER.md`. Future spatial board objects only. Do not build draggable objects, AxisBoardItem, uploads, voice, camera, memory, or CV. |
| Axis Evidence Layer | Future | Research Proof | Needs proof rules before build. |
| Axis Witness Layer | Future | Research Proof | Needs source/confidence boundaries. |
| Axis Mission Layer | Future | Hold | Depends on clean understanding and evidence boundaries. |
| Axis Challenge System | Future | Hold | Strong concept, but not current MVP. |
| Axis Memory Layer | Future | Do Not Build Yet | Requires consent/design and proof. |
| Axis Voice Layer | Future | Do Not Build Yet | Text must work first. |
| Axis Camera Layer | Future | Do Not Build Yet | Evidence layer must be defined first. |
| Axis Upload / Media Layer | Future | Do Not Build Yet | Upload-first workflow is out of MVP. |
| Axis CV / Replay / Overlay | Future | Do Not Build Yet | Preserve infrastructure but do not build into MVP. |
| Axis Annotation Layer | Future | Define Capsule | Useful later; separate from Thread Board. |
| Axis Sketch Layer | Future | Hold | Do not build until visual need is proven. |
| Axis Export Layer | Future | Do Not Build Yet | Export cannot become core workflow. |

## Build Rule

Nothing gets built unless it belongs to an active capsule or a Build Map item marked Build Now or Refine Current.

Future capsules can be referenced, but they must not drive MVP code.

## Current MVP Lock

Allowed active build:

- Axis Conversation Layer
- Axis Understanding Primitives
- Axis Thread Board

Allowed current files:

- `src/app/axis/page.tsx`
- `src/app/axis/thread-board.tsx`
- `src/app/api/axis/conversation/route.ts`
- `AGENTS.md`
- `docs/REPO_CLEANUP.md`
- `docs/AXIS_BUILD_MAP.md`
- `docs/capsules/AXIS_CAPABILITY_INDEX.md`

Do not build from future capsules unless explicitly instructed.
