# Axis Build Map

Status: Active build control document
Purpose: Decide what gets built now, refined now, researched, held, archived, or blocked.

Axis should not build from excitement, screenshots, or isolated ideas. Axis builds from locked layers, proven patterns, and active capability capsules.

## Current Build Thesis

Axis MVP is a text-first conversation that organizes rough input into usable understanding.

The MVP is not a whiteboard, dashboard, video tool, notebook, camera product, voice assistant, memory system, mission tracker, or analytics surface.

The MVP should prove one thing:

Can Axis take a rough thread and make it easier to understand and act on while the conversation continues?

## Active MVP Scope

Build Now:

1. Axis Conversation Layer
2. Axis Understanding Primitives
3. Axis Thread Board

Refine Current:

1. `/axis` page
2. `/api/axis/conversation`
3. Thread Board rendering
4. Response quality
5. Board sanitization
6. Gym-readable layout

Do Not Build Yet:

1. Whiteboard Renderer
2. Board Object Layer
3. Evidence Layer
4. Witness Layer
5. Mission Layer
6. Challenge System
7. Memory Layer
8. Voice Layer
9. Camera Layer
10. Upload / Media Layer
11. CV / Replay / Overlay
12. Annotation Layer
13. Sketch Layer
14. Export Layer

## Decision Labels

Use only these build decisions:

- Build Now
- Refine Current
- Define Capsule
- Research Proof
- Hold
- Future Layer
- Archive
- Do Not Build Yet

No vague statuses like "maybe," "interesting," "soon," or "later."

## Build Decision Table

| Concept | Type | Layer | Current Status | Proof Pattern | Build Decision | Why |
|---|---|---|---|---|---|---|
| Axis Conversation Layer | Capability | Understanding | Active MVP | Coaching conversation, design critique, structured consult | Build Now | This is the first surface and the main value test. |
| Conversation as product | Product behavior | Conversation | Active | Coaching dialogue, therapy/coaching conversations | Build Now | Axis must be useful before any extra surface appears. |
| Reply organizes before asking | Response rule | Conversation | Active | Structured consult response | Build Now | Axis must give shape before asking the next question. |
| Axis Understanding Primitives | Semantic structure | Understanding | Active | Observation, hypothesis, intervention, outcome patterns | Build Now | These are the atoms of understanding. |
| Observation | Understanding primitive | Understanding | Active | Field note, clinical observation, investigation note | Build Now | Separates what happened from what it means. |
| Pattern | Understanding primitive | Understanding | Active | Trend, recurring issue, debugging pattern | Build Now | Repetition changes priority and meaning. |
| Relationship | Understanding primitive | Understanding | Active | Cause/dependency note, case relationship | Build Now | Understanding depends on how things connect. |
| Question | Understanding primitive | Understanding | Active | Open issue, design question, clinical question | Build Now | Protects uncertainty and keeps the thread honest. |
| Hypothesis | Understanding primitive | Understanding | Active | Working diagnosis, debugging theory | Build Now | Gives a testable explanation without pretending certainty. |
| Intervention | Understanding primitive | Development | Active | Coaching cue, treatment plan, design adjustment | Build Now | Understanding should produce a concrete change. |
| Outcome / Next Move | Understanding primitive | Development | Active | After-action next step | Build Now | Axis must move the work forward. |
| Thread Board | Surface | Understanding | Prototype | Progress note, coaching board, sketchnote | Refine Current | It makes the thread easier to understand, but must stay inline and compact. |
| Thread Board sections | Rendering pattern | Thread Board | Prototype | Lesson board sections, clinical note sections | Refine Current | Sections help the user scan the thread without switching modes. |
| `/axis` layout | UI surface | Conversation | Active | Conversation feed + organized summary | Refine Current | Must be gym-readable and one-flow. |
| `/api/axis/conversation` | API | Conversation | Active | Structured response generation | Refine Current | Should return reply + threadBoard cleanly. |
| Thread Board sanitization | Infrastructure | Thread Board | Needed | Render-safe output validation | Refine Current | Board cannot show raw markdown, debug text, or weird glitches. |
| Whiteboard Renderer | Future renderer | Understanding | Prototype demoted | Detective board, coaching whiteboard, strategy board | Future Layer | Useful later, but not the product and not a mode now. |
| Axis Whiteboard Renderer / Board Object Layer | Future capsule | Whiteboard/Future | Defined only | Spatial board object renderer | Define Capsule | Make useful understanding object-ready before making objects permanent. Not Build Now. |
| Whiteboard View | UI surface | Future | Preserved prototype | Whiteboard summary | Hold | Should not be active until Thread Board proves value. |
| Cards | Visual form | UI | Risky | Modular response objects | Hold | Cards are renderers, not the product. |
| Evidence Layer | Capability | Evidence | Defined but inactive | Legal case files, clinical proof, sports film | Research Proof | Needs proof rules before build. |
| Evidence object | Object | Evidence | Existing concept | Supporting exhibit tied to claim | Research Proof | Must stay tied to claims, not become a separate graph. |
| Witness Layer | Capability | Evidence | Existing concept | Witness statement, sensor attestation | Research Proof | Needs source/confidence boundaries. |
| Verdict | Object | Evidence | Existing concept | Review finding | Research Proof | Must avoid binary pass/fail when evidence is ambiguous. |
| Camera Witness | Input/evidence | Evidence | Future | Video review, film study | Do Not Build Yet | Camera cannot become the product. |
| Voice Layer | Input | Conversation | Future | Dictation, coach note | Do Not Build Yet | Text conversation must work first. |
| Upload / Media | Input | Evidence | Future | Evidence intake | Do Not Build Yet | Upload-first workflow breaks MVP focus. |
| CV detections/tracks/events | Infrastructure | Evidence/CV | Existing legacy/future | Sports tracking pipeline | Do Not Build Yet | Raw model internals should not drive current MVP. |
| Replay | Surface | Evidence/CV | Future | Film review reconstruction | Do Not Build Yet | Do not rebuild a video editor inside Axis. |
| Overlay | Surface | Evidence/CV | Future | Telestration | Do Not Build Yet | Visual overlay is support, not core. |
| Mission Layer | Capability | Development | Future | Training assignment, treatment plan | Hold | Depends on clean understanding and evidence boundaries. |
| Challenge | Object | Development | Future | Constraint-led drill | Hold | Strong concept, but not current MVP. |
| Constraint | Object | Development | Future | Constraint-led coaching rule | Hold | Useful later; should not reintroduce Mission Control. |
| Practice design | Object/process | Development | Future | Drill design | Hold | Comes after intervention quality is reliable. |
| Experiment | Process | Development | Future | Test cycle, product experiment | Research Proof | Strong pattern, but needs boundary from casual conversation. |
| Demonstration | Output | Understanding/Development | Future | Show-me model, education example | Hold | Useful when visual/action layers return. |
| Mental model | Output | Understanding | Existing concept | Explanatory model | Define Capsule | Useful as language, but should not become jargon. |
| Adjustment | Process | Development | Future | Coaching adjustment, design critique | Hold | Needs evidence/intervention loop first. |
| Review session | Process | Development | Future | After-action review | Research Proof | Likely important, but not MVP build. |
| Orchestrator | Internal process | Infrastructure | Legacy/future | Triage/routing process | Hold | Keep invisible; do not expose complexity. |
| AxisUnderstanding | Schema/concept | Understanding | Legacy/future | Case formulation | Define Capsule | Could be useful but must not expose full schema. |
| AxisPattern | Schema/concept | Understanding | Legacy/future | Pattern formulation | Define Capsule | Needs boundary from movement pattern vs conversation pattern. |
| AxisObservation | Schema/concept | Understanding | Legacy/future | Observation note | Define Capsule | Must not label every asset as an observation. |
| AxisBelief | Schema/concept | Understanding | Legacy/future | Working belief | Research Proof | Risk of psychologizing user unnecessarily. |
| Player model | Object/model | Memory | Future | Athlete profile | Do Not Build Yet | Long-term memory requires consent/design. |
| Development memory | Capability | Memory | Future | Longitudinal progress note | Do Not Build Yet | Useful later; not MVP. |
| Behavioral domains | Model | Legacy/future | Legacy | Behavior design audit | Archive | Avoid old leaderboard/check-in drift. |
| Feedback loop | Product loop | Foundation | Future | Reinforcement loop | Research Proof | Avoid manipulative engagement loops. |
| Check-in / check-out | Ritual | Session | Legacy/future | Session boundaries | Hold | Do not reintroduce excluded flow. |
| Leaderboard | Surface | Competition | Legacy | Competitive ranking | Archive | Do not make comparison core Axis experience. |
| Annotation Layer | Capability | Understanding | Future | Marginalia, critique marks | Define Capsule | Useful later; must stay separate from Thread Board. |
| Sketch Layer | Capability | Visual | Future | Telestration, sketchnotes | Hold | Do not build until visual need is proven. |
| Motion blueprint | Notation | Development | Future | Movement notation | Research Proof | Avoid raw notation as UI. |
| Live coaching intervention | Output | Development | Future | Real-time cue | Hold | Strong for gym use, but premature as system layer. |
| Environment layout | Object | Development | Future | Practice setup | Hold | Useful later with NVNTN/physical programming. |
| Real-time Axis | Runtime | Live coaching | Future | Live coaching loop | Do Not Build Yet | Avoid always-on surveillance feel. |
| Axis Operating System | Runtime | Infrastructure | Legacy/future | Integrated coaching runtime | Hold | Internal only; must not dictate active UI. |
| Cartridges | Domain plugins | Future | Future | Domain playbooks/plugins | Hold | Avoid fragmented vocabulary. |
| Surface hierarchy | Information architecture | Legacy | Archived | Product IA | Archive | Do not recreate sidebar/dashboard sprawl. |
| Perception hierarchy | CV model | Future | Future | Perception pipeline | Hold | Do not mix CV hierarchy into current Thread Board. |
| Connection graph | Data model | Future | Future | Knowledge graph | Research Proof | Avoid user-facing graph database. |
| Core loop | Foundation pattern | Foundation | Needs consolidation | Learning cycle, AAR | Define Capsule | Must align with current foundation before build. |
| Signal Stack | Multimodal model | Future | Future | Multimodal sensing | Do Not Build Yet | Modalities are not active MVP. |

## Active Build Order

### 1. Stabilize `/axis`

Goal:
Make the current page usable in a gym.

Required:

- One vertical or focus-friendly feed
- No split-focus layout unless proven usable
- No separate Whiteboard mode
- No thick internal scrollbars
- Input does not cover content
- Thread Board stays readable and compact

Decision:
Refine Current

### 2. Stabilize Conversation Response Quality

Goal:
Axis gives shape before asking.

Required:

- Short user inputs become thread titles
- Axis organizes before asking
- No clarification-only responses
- No consultant language
- No markdown
- No long paragraphs in gym context

Decision:
Build Now

### 3. Stabilize Thread Board

Goal:
Thread Board makes the thread easier to understand at a glance.

Required:

- Uses Understanding Primitives
- Does not show primitive labels unless useful
- Shows only useful sections
- Sanitized output
- Compact rendering
- No raw arrows, markdown, debug text, or malformed items

Decision:
Refine Current

### 4. Validate With Real Threads

Use real gym prompts:

Thread 1:

- jumpshot
- the shot
- footwork

Thread 2:

- Hailey had 12 points
- floaters i want her to shoot more
- hesitation she does the floater well its she doesnt look to shoot off the dribble enough

Success test:
Does the Thread Board help the user understand the thread faster while the conversation stays usable?

Decision:
Build Now

## Build Freeze

Until the current MVP passes live gym use, do not build:

- Whiteboard Renderer
- Evidence
- Witness
- Mission
- Challenge system
- Memory
- Voice
- Camera
- Upload
- CV
- Replay
- Overlay
- Annotation
- Sketch
- Export
- Player model
- Long-term history

## Allowed MVP Files

Codex may touch these for current MVP refinement:

```text
src/app/axis/page.tsx
src/app/axis/thread-board.tsx
src/app/api/axis/conversation/route.ts
AGENTS.md
docs/REPO_CLEANUP.md
docs/AXIS_BUILD_MAP.md
```

Codex should not touch these unless explicitly instructed:

```text
src/app/axis/whiteboard-view.tsx
src/app/api/axis/whiteboard/route.ts
src/lib/axis*
archive/
context/
legacy API routes
video/CV routes
storage/auth infrastructure
```

## Build Ticket Format

Every future coding task must use this structure:

```text
Build Ticket

Name:
Layer:
Object:
Proof Pattern:
Build Decision:
User Problem:
Smallest Test:
Files Allowed:
Files Not Allowed:
Acceptance Test:
Checks:
Commit Message:
```

If a task cannot fill this out, do not build it.

## Current MVP Acceptance Test

Axis MVP passes when:

1. User can type rough input fast.
2. Axis gives useful shape before asking.
3. Axis does not make the user manage screens or tools.
4. Thread Board organizes the current thread without feeling like a dashboard.
5. User can read the conversation and board in a gym.
6. The board makes the thread easier to understand at a glance.
7. No future layer is required for the MVP to be valuable.

## Current Status

Build state:

Refine Current

Active MVP:

- Axis Conversation Layer
- Axis Understanding Primitives
- Axis Thread Board

Next action:

Fix `/axis` for gym readability and validate the active MVP with real use before building any future layer.
