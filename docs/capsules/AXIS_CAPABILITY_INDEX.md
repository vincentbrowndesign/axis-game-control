# Axis Capability Index

Purpose:
This index controls which capability capsules are active, which are future, and which must not drive the MVP.

## Active MVP Capsules

| Capsule | Status | Build Decision | Notes |
|---|---|---|---|
| Axis Conversation Layer | Active | Build Now | Text-first surface. Organizes rough input before asking. |
| Axis Understanding Primitives | Active | Build Now | Observation, Pattern, Relationship, Question, Hypothesis, Intervention, Outcome. |
| Axis Thread Board | Active | Refine Current | Inline comprehension view of the current thread. Not a separate screen. |
| Axis Visual Language | Active foundation | Build Now | Shared palette and visual status styles for the current Thread Board and BoardSectionObject renderer. No new mode, API, persistence, evidence, memory, or manual creation. |
| Axis Thread Persistence v0 | Active narrow capability | Build Now | Owner-scoped saved conversation threads and Thread Board snapshots. No cross-thread memory, player model, evidence, or persistent board arrangement. |
| Axis Auth v0 | Active narrow capability | Build Now | Explicit sign-in, account creation, sign-out, session restoration, and account-switch isolation for owner-scoped Thread Persistence. No profiles, organizations, billing, memory, or role system. |
| Axis Data Asset Contract v0 | Active foundation - complete | Foundation complete | Shared types and lifecycle boundaries for future Source Records, Structured Records, Datasets, Data Assets, and Output Products. Locked by `93cfbfe` technical vocabulary and `31a214f` product/build boundaries. No third implementation chunk, runtime creation, persistence, cross-thread memory, verification, UI, or background processing. |

## Refine Current

| Capsule / Area | Status | Build Decision | Notes |
|---|---|---|---|
| `/axis` page | Active MVP surface | Refine Current | Must become gym-readable and one-flow. |
| `/api/axis/conversation` | Active API | Refine Current | Returns reply + threadBoard. |
| Thread Board rendering | Active renderer | Refine Current | Must be compact, sanitized, readable, and non-dashboard. |
| BoardSectionObject Local Prototype | Active local prototype | Build Now | Converts generated Thread Board sections into movable local render units only. No API change, persistence, memory, evidence, upload, or manual creation. |

## Future / Hold Capsules

| Capsule | Status | Build Decision | Notes |
|---|---|---|---|
| Axis Whiteboard Renderer | Future | Future Layer | Renderer only. Not the product. Not active MVP. |
| Axis Whiteboard Renderer / Board Object Layer | Future | Define Capsule | Defined in `docs/capsules/AXIS_BOARD_OBJECT_LAYER.md`. Mostly future. Only BoardSectionObject Local Prototype is Build Now; draggable cards beyond generated sections, AxisBoardItem, uploads, voice, camera, memory, evidence, persistence, and CV remain locked out. |
| Axis Data Asset Layer | Future | Define Capsule | Future operational layer for governed structured records, datasets, reusable assets, and derived outputs. No runtime implementation is active. |
| Axis Asset Flywheel | Strategy | Define Capsule | Business and field-test model for how future governed source records may become reusable outputs, distribution signals, and better next sessions. No operational Data Asset runtime or monetization tooling is active. |
| Axis Evidence Layer | Future | Research Proof | Needs proof rules before build. |
| Axis Witness Layer | Future | Research Proof | Needs source/confidence boundaries. |
| Axis Mission Layer | Future | Hold | Depends on clean understanding and evidence boundaries. |
| Axis Challenge System | Future | Hold | Strong concept, but not current MVP. |
| Axis Memory Layer | Future | Do Not Build Yet | Requires consent/design and proof. |
| Axis Lens | Future | Do Not Build Yet | Future sensing/ingestion layer. Cannot create verified truth or bypass Evidence/Witness boundaries. |
| Axis Voice Layer | Future | Do Not Build Yet | Text must work first. |
| Axis Camera Layer | Future | Do Not Build Yet | Evidence layer must be defined first. |
| Axis Upload / Media Layer | Future | Do Not Build Yet | Upload-first workflow is out of MVP. |
| Axis CV / Replay / Overlay | Future | Do Not Build Yet | Preserve infrastructure but do not build into MVP. |
| Axis Annotation Layer | Future | Define Capsule | Useful later; separate from Thread Board. |
| Axis Sketch Layer | Future | Hold | Do not build until visual need is proven. |
| Axis Export Layer | Future | Do Not Build Yet | Export cannot become core workflow. |

## Internal Development Surfaces

| Surface | Status | Build Decision | Notes |
|---|---|---|---|
| Axis UI Lab v1 | Internal preview | Refine Current | Mock-only aperture work-surface at `/axis/lab`. Aperture Shell pattern, focus states, Lens Bridge preview. No API, Supabase, auth, persistence, media, Data Asset runtime, CV, or active-product behavior. Capsule: `docs/capsules/AXIS_UI_LAB.md`. |
| Axis Lens UI Bridge | Internal mock preview | Refine Current in `/axis/lab` only | Mock-only visual-source presentation inside the Aperture Shell. No CV runtime, no media permissions, no camera, no file selection, no clip analysis, no upload. Source candidates are not verified evidence. Promotion to a real Lens runtime requires a separate decision to advance the Axis Lens capsule (currently Do Not Build Yet). |

## Build Rule

Nothing gets built unless it belongs to an active capsule or a Build Map item marked Build Now or Refine Current.

Future capsules can be referenced, but they must not drive MVP code.

## Current MVP Lock

Allowed active build:

- Axis Conversation Layer
- Axis Understanding Primitives
- Axis Thread Board
- Axis Visual Language
- Axis Thread Persistence v0
- Axis Auth v0
- Axis Data Asset Contract v0 is complete as an active foundation

Allowed current files:

- `src/app/axis/page.tsx`
- `src/app/axis/thread-board.tsx`
- `src/app/api/axis/conversation/route.ts`
- `src/app/api/axis/threads/route.ts`
- `src/app/api/axis/threads/[threadId]/route.ts`
- `src/app/axis/thread-picker.tsx`
- `src/app/axis/axis-auth-control.tsx`
- `src/lib/axis-visual-language.ts`
- `src/lib/axis-thread-persistence.ts`
- `src/lib/axis-data-assets.ts`
- `AGENTS.md`
- `docs/REPO_CLEANUP.md`
- `docs/AXIS_BUILD_MAP.md`
- `docs/capsules/AXIS_CAPABILITY_INDEX.md`

Do not build from future capsules unless explicitly instructed.
