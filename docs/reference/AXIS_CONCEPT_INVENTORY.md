Status: REFERENCE

Why moved: useful audit material, but too broad to act as current build truth.

Current replacement source: `docs/AXIS_INDEX.md`

---

# Axis Concept Inventory

Audit date: 2026-06-18

Scope inspected: `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/`, `archive/` for historical context, `src/app/axis/`, `src/app/api/axis/`, `src/lib/axis*`, and Axis-named agent/plugin files.

Status terms:
- Active: part of the current `/axis` MVP flow.
- Passive active: rendered or validated in the current flow, but not manually edited by the user.
- Preserved infrastructure: code still present, not active in the `/axis` MVP.
- Legacy/historical: archived or documented as prior direction.
- Research candidate: appears as an idea or boundary, but needs product/industry validation.

## Inventory

| Concept Name | Category | Current Layer | Where It Appears | Plain Meaning | What It Owns | What It Does Not Own | Current Status | Risk of Confusion | Keep / Merge / Archive / Research |
|---|---|---|---|---|---|---|---|---|---|
| Axis | Foundation | Product | README, CLAUDE, AGENTS, docs, app, API, lib | The overall product/system name. | Product identity and organizing principle. | Any single UI, API, or coaching mode. | Active | High because it names many old systems too. | Keep |
| Axis Conversation MVP | Foundation | Product boundary | README, CLAUDE, AGENTS, `docs/AXIS_CONVERSATION_MVP.md` | Current active product: conversation as the product. | Current scope and exclusions. | Legacy missions, uploads, dashboards, CV, long-term memory. | Active | Medium because preserved code still exists. | Keep |
| Conversation is the product | Foundation | Product principle | README, CLAUDE, AGENTS, `docs/AXIS_CONVERSATION_MVP.md` | The thread itself is the working surface. | MVP focus and design decisions. | Separate dashboards or workspaces. | Active | Medium where board/whiteboard language reappears. | Keep |
| Conversation develops the work | Foundation | Product principle | User specs, `whiteboard` prompt, AGENTS | Raw exchange is where ideas form. | Role of transcript and reply. | Final organization or permanent record. | Active | Low | Keep |
| Organized understanding | Understanding | Product output | `src/app/axis/page.tsx`, thread board docs/code | Axis groups what the conversation is starting to mean. | Passive right-side board contents. | Manual board editing. | Active | Medium with Whiteboard. | Keep |
| Axis organizes | Foundation | Product principle | User specs, prompts, docs | User contributes material; Axis structures it. | Relationship between user input and generated board. | User-created structure. | Active | Low | Keep |
| Thread | Conversation | Data/product object | `page.tsx`, `axis-server.ts`, APIs, docs | A single conversation/work unit. | History, current focus, questions, next action. | Player-wide memory unless explicitly modeled. | Active plus preserved infra | Medium with History and Memory. | Keep |
| Conversation history | Conversation | Client/API input | `page.tsx`, `conversation/route.ts` | Chronological messages sent to the API. | Source material for reply and thread board. | Long-term memory. | Active | Medium with Memory. | Keep |
| Transcript | Conversation | UI surface | `page.tsx` | Left column showing chronological messages. | Conversation display and scroll. | Board organization. | Active | Low | Keep |
| Chat | Conversation | Generic pattern | Historical docs, code language | Generic message exchange pattern. | Basic message mechanics. | Product framing. | Passive term | Medium with Conversation. | Merge into Conversation language |
| Assistant reply | Conversation | API output | `conversation/route.ts`, `page.tsx` | Axis text response. | Immediate response to user. | Full board state. | Active | Low | Keep |
| Reply organizes before asking | Prompt | Prompt rule | `conversation/route.ts` | Axis should first name structure, then ask at most one useful question. | Response behavior. | Generic clarification flow. | Active | Low | Keep |
| Smallest next question | Prompt | Conversation rule | AGENTS, `AXIS_CONVERSATION_MVP.md`, route prompt | Ask only when it moves the work forward. | Question style. | Interrogation or onboarding. | Active | Low | Keep |
| No broad clarification-only responses | Prompt | Prompt rule | `conversation/route.ts`, AGENTS | Axis must not punt to generic questions. | Response guardrail. | Content generation by itself. | Active | Low | Keep |
| Anti-cliche rules | Prompt | Prompt rule | AGENTS, `AXIS_CONVERSATION_MVP.md`, route prompt | Avoid consultant/coach cliches and stuck framing. | Tone boundary. | Product structure. | Active | Low | Keep |
| Catch / Develop / Return / Move | Conversation | Prompt/product behavior | `docs/AXIS_CONVERSATION_MVP.md` | Conversation loop for noticing, shaping, returning language, and moving forward. | Response progression. | Board schema. | Active doc | Medium with Thread Board primitives. | Keep |
| Message | API | Client type | `page.tsx` | UI record with role, content, optional board. | Local browser state. | Server persistence. | Active | Low | Keep |
| `threadBoard` property | Thread Board | API/client contract | `page.tsx`, `conversation/route.ts`, `thread-board.tsx` | Optional structured board attached to assistant response. | Board payload for latest assistant response. | Every historical message's board. | Active | Low | Keep |
| Latest assistant board only | Thread Board | UI rule | `page.tsx` | Only the newest assistant board is shown on the right. | Avoids repeated stale boards. | Board history. | Active | Low | Keep |
| Thread Board | Thread Board | Passive UI surface | `page.tsx`, `thread-board.tsx`, `conversation/route.ts` | Current organized understanding generated from the thread. | Title, summary, sections, defensive rendering. | Manual editing, canvas, whiteboard tools. | Active | High with Whiteboard. | Keep and keep boundary explicit |
| ThreadBoardData | Thread Board | Type/API contract | `thread-board.tsx`, `page.tsx`, route prompt | Type for title, summary, and sections. | Shape of board data. | Prompt reasoning itself. | Active | Low | Keep |
| Thread board title | Thread Board | UI/data field | `thread-board.tsx`, route prompt | Short name for what the thread is about. | Board heading. | App page title. | Active | Low | Keep |
| Thread board summary | Thread Board | UI/data field | `thread-board.tsx`, route prompt | Compact synthesis of current understanding. | Board overview. | Full assistant reply. | Active | Low | Keep |
| Thread board section | Thread Board | Primary primitive | `thread-board.tsx`, route prompt | A grouped block of related understanding. | Label and up to three items. | Freeform canvas objects. | Active | Low | Keep |
| Observation | Understanding | Thread Board primitive | `conversation/route.ts`, `thread-board.tsx`, APIs/libs | What happened or was noticed. | Direct noticed facts/signals. | Interpretive meaning or evidence asset storage. | Active | Medium with Evidence. | Keep |
| Pattern | Understanding | Thread Board primitive | `conversation/route.ts`, `thread-board.tsx`, many docs/libs | Repeated or shaping behavior. | Recurrence and tendency. | Single evidence item. | Active | Medium with Relationship and Understanding. | Keep |
| Relationship | Understanding | Thread Board primitive | `conversation/route.ts`, `thread-board.tsx`, `axis-server.ts` | How two things affect or depend on each other. | Connection between ideas/objects/causes. | Graph database edges. | Active | Medium with Hierarchy. | Keep |
| Question | Understanding | Thread Board primitive | `conversation/route.ts`, `thread-board.tsx`, `axis-server.ts` | Open uncertainty that matters. | Specific next unknown. | Generic clarification. | Active | Low | Keep |
| Hypothesis | Understanding | Thread Board primitive | `conversation/route.ts`, `thread-board.tsx`, experiment APIs | A testable possible explanation. | Provisional claim. | Final verdict. | Active | Medium with Belief and Experiment. | Keep |
| Intervention | Understanding | Thread Board primitive | `conversation/route.ts`, `thread-board.tsx`, operating system | Proposed move, cue, or action. | What to try or change next. | Mission challenge mechanics. | Active | Medium with Challenge. | Keep |
| Outcome / Next Move | Understanding | Thread Board primitive | `conversation/route.ts`, `thread-board.tsx` | Result or next actionable direction. | Follow-through. | Full task manager. | Active | Medium with Mission/Challenge. | Keep |
| Understanding Primitives | Understanding | Prompt/API reasoning | `conversation/route.ts`, AGENTS, whiteboard route | Controlled primitives for generated organization. | Board section taxonomy. | User-facing raw labels like Point or State. | Active | Medium with legacy primitives. | Keep |
| Invalid board fallback | API | Validation guard | `conversation/route.ts`, `thread-board.tsx` | Bad board data becomes `null` or hidden. | Defensive behavior. | Repairing model output visually. | Active | Low | Keep |
| Raw arrow ban | Prompt | Validation/prompt rule | `conversation/route.ts` | Prevents arrow glyph output in reply/board. | Text cleanliness. | Semantics of relationships. | Active | Low | Keep |
| Primitive label ban | Prompt | Validation/prompt rule | `conversation/route.ts` | Prevents labels such as Point, State, Group, Direction. | User-facing language guardrail. | Internal reasoning concepts. | Active | Medium with whiteboard internals. | Keep |
| `/axis` route | UI | Active route | `src/app/axis/page.tsx` | Active Axis page. | Transcript, Thread Board, composer. | Mission page, whiteboard standalone route. | Active | Low | Keep |
| Axis page shell | UI | Layout | `page.tsx` | Full viewport two-layer layout. | Left transcript, right board, fixed input. | Sidebars, dashboards, app-wide nav. | Active | Medium with old sidebar/thread UI. | Keep |
| Left transcript column | UI | Layout | `page.tsx` | Narrow conversation column. | Chronological messages and scroll. | Board content. | Active | Low | Keep |
| Right organized board area | UI | Layout | `page.tsx` | Passive board area for latest Thread Board. | Organized understanding. | Whiteboard workspace/manual tools. | Active | Medium | Keep |
| Bottom input/composer | UI | Interaction | `page.tsx` | Fixed input for user messages. | New user turns. | Board editing controls. | Active | Low | Keep |
| Thinking state | UI | Interaction state | `page.tsx` | Shows assistant is responding. | Loading feedback. | Progress workflow. | Active | Low | Keep |
| Error state | UI | Interaction state | `page.tsx` | Shows response failure. | Recovery cue. | Monitoring system. | Active | Low | Keep |
| `/api/axis/conversation` | API | Active API | `conversation/route.ts` | Active Axis conversation endpoint. | Reply plus optional Thread Board. | Legacy `/api/axis/run`. | Active | Low | Keep |
| `AXIS_SYSTEM` | Prompt | Active prompt | `conversation/route.ts` | Main conversation system prompt. | Response and board behavior. | Legacy whiteboard/run behavior. | Active | Low | Keep |
| JSON response contract | API | Active contract | `conversation/route.ts` | `{ reply, threadBoard }`. | API shape used by `/axis`. | Streaming, persistence, tool calls. | Active | Low | Keep |
| Whiteboard | Whiteboard | Future standalone renderer | `whiteboard-view.tsx`, `whiteboard/route.ts`, AGENTS, cleanup docs | Generated comprehension view, now not active on `/axis`. | Future standalone renderer and legacy prompt. | Active page behavior or manual canvas. | Preserved future | High with Thread Board. | Keep as future, do not activate |
| WhiteboardView | Whiteboard | Component | `src/app/axis/whiteboard-view.tsx` | Old/future renderer for whiteboard data. | Section rendering for standalone future. | Current `/axis` rendering. | Preserved future | High | Archive later if replaced |
| `/api/axis/whiteboard` | Whiteboard | API route | `src/app/api/axis/whiteboard/route.ts` | Separate whiteboard generator. | Future standalone whiteboard data. | Active conversation response. | Preserved future | High | Research or merge later |
| Whiteboard internal primitives | Whiteboard | Prompt internals | `whiteboard/route.ts`, AGENTS | Points, Relationships, Groups, Time, Evidence, States, Changes. | Internal comprehension pass. | User-facing labels. | Preserved future | High with active primitives. | Merge/reconcile |
| Whiteboard sections | Whiteboard | Prompt/UI schema | `whiteboard/route.ts`, AGENTS | Topic, Question, Observation, Pattern, Understanding, Evidence, Intervention, Outcome, Mission, Capability, Behavior, Environment, Action Items. | Legacy/future section labels. | Current Thread Board labels. | Preserved future | High | Merge/research |
| Dry erase board language | Whiteboard | Visual/product language | User specs, whiteboard prompts | Titles, dividers, bullets, checkmarks, underlines, boxes, circles. | Visual metaphor for organized work. | Manual drawing app. | Research candidate | Medium | Research |
| Section as primitive | Whiteboard | Product object | User specs, whiteboard route | Everything organized into sections. | Board grouping. | Nodes/cards. | Active concept via Thread Board | Low | Keep |
| Evidence inside sections | Evidence | Product rule | User specs, whiteboard route, docs | Evidence supports the section it belongs to. | Contextual proof display. | Separate evidence graph/database view. | Preserved/future | Medium | Keep boundary |
| Evidence | Evidence | Cross-cutting object | `axis-evidence.ts`, APIs, docs, archived docs | Support for claims or required challenge proof. | Kind, source, value, comparison. | Observation semantics by itself. | Preserved infra | High with Observation. | Keep with boundary |
| EvidenceKind | Evidence | Type | `axis-evidence.ts`, `axis-challenges.ts` | COUNT, OBSERVATION, PRESENCE, COMPLETION. | Required proof type. | Source/channel. | Preserved infra | Medium | Keep |
| EvidenceSource | Evidence | Type | `axis-evidence.ts` | VOICE, CAMERA, PRESENCE, COACH, USER, SYSTEM. | Evidence origin. | Evidence meaning. | Preserved infra | Medium with Camera/Voice. | Keep |
| Evidence upload | Upload | API capability | `src/app/api/axis/evidence/upload` and cleanup docs | Uploading evidence files. | File-based evidence intake. | Active `/axis` MVP. | Preserved infra | Medium | Archive or research |
| Artifacts | Evidence/API | API capability | `src/app/api/axis/artifacts` | Generated or stored outputs from a loop. | Artifact outcomes such as observe/improve/share/extend. | Active conversation board. | Preserved infra | Medium | Research |
| Facts | Evidence/API | API capability | `src/app/api/axis/facts` | Structured facts such as shot attempts or paint touches. | Low-level factual records. | Interpretive understanding. | Preserved infra | Medium | Research |
| Witness | Evidence | API/prompt concept | `axis-core.ts`, witness APIs, camera-witness | A modality/source that can validate a claim. | Verdicts, dimensions, confidence, raw references. | Full memory model. | Preserved infra | Medium | Keep/research |
| WitnessDimension | Evidence | Type | `axis-core.ts`, cartridge docs | What a witness is checking. | Measurement/observation target. | Domain ontology by itself. | Preserved infra | Medium | Research |
| Verdict | Evidence | Type | `axis-core.ts`, camera-witness, review APIs | satisfied, violated, partial, unobservable. | Claim evaluation result. | Coaching response. | Preserved infra | Medium | Keep |
| Camera witness | Camera | API capability | `src/app/api/axis/camera-witness` | Camera-based validation of drill behavior. | Visual witness verdicts. | Active MVP. | Preserved infra | Medium | Research |
| Voice | Voice | Modality | `axis-core.ts`, `axis-real-time.ts`, docs | Spoken input or coaching channel. | Transcripts, confidence, real-time observations. | Conversation product definition. | Preserved infra | Medium with Conversation. | Research |
| Camera | Camera | Modality | `axis-core.ts`, `axis-camera-foundation.ts`, APIs, docs | Visual input source. | Frames, calibration, video evidence. | Evidence semantics. | Preserved infra | High with Evidence/CV. | Research |
| Upload | Upload | Capability | README/CLAUDE exclusions, upload APIs, cloud-store/upload-stream libs | File/video intake. | Blob/video ingest mechanics. | Current `/axis` page. | Preserved infra | Medium | Archive or research |
| CV | CV | Infrastructure/capability | `axis-cv-*`, ball/video APIs, docs | Computer vision observation layer. | Detections, tracks, events, overlay/replay inputs. | Active conversation MVP. | Preserved infra | Medium | Research |
| AxisDetection | CV | Type | `axis-primitives.ts` | Raw detected object per frame. | Entity, bbox, confidence, frame. | Higher-level coaching meaning. | Preserved infra | Low | Keep infra |
| AxisTrack | CV | Type | `axis-primitives.ts`, tracking libs | Continuous object identity across frames. | Positions, gaps, confidence. | Semantic event logic. | Preserved infra | Low | Keep infra |
| AxisEvent | CV/Session | Type | `axis-primitives.ts`, `axis-server.ts` | Semantic event or stored message depending file. | Replay reconstruction or thread events. | Single universal event meaning. | Preserved infra | High name collision. | Rename/reconcile later |
| AxisReplayFrame | Video | Type | `axis-primitives.ts`, replay renderer | Synthesized replay frame from track/event data. | Video-free replay frame data. | Actual video bytes. | Preserved infra | Medium | Research |
| Ball processing | CV | API/lib capability | ball APIs, `axis-ball-*` | Ball detection/job processing. | Ball tracks and debug processing. | Conversation board. | Preserved infra | Medium | Research |
| Video jobs | Video | API/lib capability | video-job APIs, `axis-video-jobs.ts` | Async video processing jobs. | Job creation/status. | Product understanding. | Preserved infra | Medium | Research |
| Decode video | Video | API capability | decode-video, decoder routes | Analyze or test video decoding. | Clip/frame interpretation tests. | Active MVP. | Preserved infra | Medium | Research |
| Replay | Video | Legacy/future capability | replay libs, archived docs | Reconstruct or review action from events/tracks. | Reviewable playback surface. | Current conversation product. | Preserved infra | Medium | Research |
| Overlay | Video/UI | Lib capability | `axis-cv-overlay.ts`, `axis-overlay-*` | Visual rendering over video/replay. | Displaying CV/coaching overlays. | Thread Board. | Preserved infra | Medium | Research |
| Export | Export | API/capability | exports API, replay/render docs | Output generated artifacts/media. | Export pipeline. | Core conversation loop. | Preserved infra | Low | Research |
| Mission | Mission | Legacy product layer | mission page redirect, mission-memory, docs/archive | Objective/constraint practice loop. | Attempts, sessions, status, memory. | Active `/axis` MVP. | Legacy/preserved infra | High with Challenge/Next Move. | Archive unless reactivated intentionally |
| Mission Control | Mission | Legacy UI | CLAUDE exclusions, archive | Old mission UI surface. | Mission operation surface. | Active conversation. | Legacy | High with dashboard. | Archive |
| Mission memory | Memory/Mission | Lib/API concept | `axis-mission-memory.ts`, mission-memory API | Local or API memory of mission attempts/sessions. | Attempts, personal best, streak, events. | Active thread history. | Preserved infra | High with Memory/History. | Archive or research |
| MissionAttempt | Mission | Type | `axis-mission-memory.ts` | One attempt at a mission objective. | Result, target, evidence, moment. | Conversation message. | Preserved infra | Medium | Archive unless used |
| MissionSession | Mission | Type | `axis-mission-memory.ts` | Active/ended/evaluated mission session. | Events and results for a mission. | General Axis session. | Preserved infra | Medium | Archive unless used |
| MissionMoment | Mission | Type | `axis-mission-memory.ts` | ALMOST, COMPLETE, FAILED, RECORD, STREAK. | Outcome label for an attempt. | Thread Board outcome. | Preserved infra | Medium | Archive |
| Challenge | Challenge | Legacy/preserved practice object | `axis-challenges.ts`, archive | Objective plus constraint requiring evidence. | Practice tasks. | Current conversation next move. | Preserved infra | High with Mission/Intervention. | Research |
| Constraint | Challenge | Product/prompt object | `axis-challenges.ts`, docs, archive | Limitation/rule shaping action. | Practice difficulty and focus. | Full objective. | Preserved infra | Medium | Keep as concept, inactive |
| Objective | Challenge | Product object | `axis-challenges.ts`, mission docs | Target to complete. | Goal of challenge/mission. | Conversation purpose. | Preserved infra | Medium | Keep inactive |
| AxisContext | Session/Practice | Type | `axis-challenges.ts` | SOLO, PARTNER, TEAM, GAME. | Practice context. | Current page mode. | Preserved infra | Medium | Research |
| Practice design | Practice | Lib capability | `axis-practice-design.ts`, operating system | Turns understanding into a practice plan. | Rep design and evidence request. | Active conversation route. | Preserved infra | Medium | Research |
| Experiment | Understanding/Practice | API/prompt/type | experiment API, `axis-server.ts`, docs | A test of a hypothesis. | Hypothesis, status, result, verdict. | Thread Board by itself. | Preserved infra | Medium with Hypothesis. | Keep/research |
| Demonstration | Practice | API/prompt/type | demonstration API, operating system | Show-me representation of a movement/idea. | Motion blueprint or explanation. | Evidence validation. | Preserved infra | Medium | Research |
| Mental model | Understanding | API/prompt concept | mental-model API, understand API | Explanation that helps user see the work differently. | Conceptual framing. | Thread Board schema. | Preserved infra | Medium | Research |
| Adjustment | Understanding | API/prompt concept | adjustment API | Chooses next card/action after review. | Decision among next cards. | Current reply endpoint. | Preserved infra | Medium | Research |
| Review session | Session/Video | API/prompt concept | review-session API | Interprets recorded replay evidence. | Session summary, active moment, notes. | Active conversation. | Preserved infra | Medium | Research |
| First loop | API | API route | first-loop API | Early loop entry point. | Unknown/legacy start of flow. | Current `/axis`. | Preserved infra | Medium | Archive/research |
| Orchestrator | API/Infrastructure | API/prompt concept | orchestrator API, archive runtime docs | Decides which Axis card/action comes next. | Routing among insight, model, demo, experiment, witness, adjustment. | Active conversation endpoint. | Preserved infra | Medium | Research |
| Understand API | Understanding/API | API route | understand API | Builds AxisUnderstanding from inputs. | Structured understanding object. | Current thread board response. | Preserved infra | High with active understanding. | Merge/research |
| AxisUnderstanding | Understanding | Type/model | `axis-server.ts`, run/understand APIs, operating system | Structured model of a thread/focus. | Concept, focus, belief, confidence, primitives, patterns, cues, experiment, evidence request. | The whole product. | Preserved infra | High with Thread Board. | Merge/research |
| AxisCapability | Foundation/API | Type | `axis-server.ts` | UNDERSTAND, DEMONSTRATE, EVIDENCE, COMPARE, LIVE_INTERVENTION. | Old capability taxonomy. | Active MVP boundary. | Preserved infra | Medium | Research |
| AxisPattern | Understanding | Type | `axis-server.ts` | Label plus objects, relationships, motion. | Pattern representation for movement/coaching. | General Thread Board pattern. | Preserved infra | Medium | Reconcile |
| AxisObservation | Understanding/Evidence | Type | `axis-server.ts`, operating system | Observation from image/video/camera/voice/document. | Summary, signals, ignored noise, updates. | Evidence asset storage. | Preserved infra | High with active Observation. | Reconcile |
| AxisBelief | Understanding/Memory | Type | `axis-server.ts`, player-model | Statement with status and confidence. | Belief tracking. | Hypothesis or board summary. | Preserved infra | Medium | Research |
| AxisCard | UI/API | Type | `axis-server.ts`, old page cleanup | Card output types such as insight, experiment, sketch, reply. | Old generated response cards. | Current Thread Board sections. | Preserved infra | High with cards ban. | Archive |
| SidebarThread | UI/Memory | Type | `axis-server.ts`, cleanup docs | Old thread list item. | Sidebar thread navigation. | Current `/axis` page. | Preserved infra | Medium | Archive |
| Supabase thread memory | Memory/Infrastructure | Server/data layer | `axis-server.ts`, cleanup docs, Supabase migrations | Persisted threads/events/beliefs. | Long-term thread storage. | Current browser-only `/axis` MVP. | Preserved infra | High with active history. | Archive/research |
| Local browser history | Memory | Client state | `page.tsx` | In-memory messages in current page session. | Current conversation display. | Long-term persistence. | Active | Medium | Keep |
| Player model | Player/Memory | Lib/API concept | `axis-player-model.ts`, player-model API | Aggregates player threads, evidence, beliefs, experiments, breakthroughs. | Development model for a person. | Current conversation page. | Preserved infra | Medium | Research |
| Development memory | Memory/Player | Type | `axis-player-model.ts` | Recurring patterns across threads. | Keeps showing up, improved, not improved. | Current MVP memory. | Preserved infra | High with History. | Research |
| Player strengths | Player | Type/output | `axis-player-model.ts` | Current confirmed strengths/breakthroughs. | Player model summary. | Thread board sections. | Preserved infra | Medium | Research |
| Player bottlenecks | Player | Type/output | `axis-player-model.ts` | Current recurring issues. | Player model summary. | Thread board Pattern only. | Preserved infra | Medium | Research |
| Behavioral system | Memory/Foundation | Lib concept | `axis-behavioral-system.ts` | Evaluates behavior captured/lost/inferred by features. | Behavioral domains, feedback loops, learning value. | Active product behavior. | Preserved infra | Medium | Research |
| Behavioral domains | Memory/Foundation | Type | `axis-behavioral-system.ts` | Identity, presence, participation, progression, history, leaderboard, return, replay_memory, organization. | Feature behavior taxonomy. | Current UI sections. | Preserved infra | High with MVP exclusions. | Archive/research |
| Feedback loop | Foundation/Memory | Type | `axis-behavioral-system.ts`, archive | Trigger, reinforcement, expected return behavior. | Behavior design evaluation. | Chat loop mechanics. | Preserved infra | Medium | Research |
| Learning value | Memory/Foundation | Type | `axis-behavioral-system.ts` | Value over session/week/season/career. | Long-term usefulness estimate. | Current MVP promise. | Preserved infra | Medium | Research |
| Leaderboard | UI/Legacy | Legacy product surface | CLAUDE exclusions, behavioral system, archive | Ranking/competition surface. | Old behavior domain. | Active product. | Legacy/preserved term | High | Archive |
| Check-in / check-out | Session/Legacy | Legacy flow | CLAUDE exclusions, behavioral system, archive | Session start/end ritual. | Old session capture. | Active conversation. | Legacy | Medium | Archive |
| Streaks | Mission/Legacy | Legacy motivation object | CLAUDE exclusions, mission memory | Consecutive success count. | Mission attempt history. | Thread Board outcomes. | Legacy/preserved | Medium | Archive |
| Dashboard | UI/Legacy | Legacy UI surface | README/CLAUDE exclusions, archive | Aggregated panels/metrics. | Old product summaries. | Active `/axis` or Thread Board. | Legacy | High with Board. | Archive |
| Cards | UI/Legacy | Legacy UI object | `axis-server.ts`, cleanup docs, archive | Discrete generated response objects. | Old response layout. | Active thread sections. | Legacy/preserved type | High with no-card direction. | Archive |
| Annotation | Annotation | Legacy/prompt concept | cleanup docs, archive | Marking text with labels like pattern/tension/evidence. | Inline meaning marks. | Sketch generation or board sections. | Legacy/historical | Medium | Archive/research |
| Sketch | Sketch | API capability | sketch API, docs, cleanup | Generated SVG coaching diagram. | Diagram generation. | Active Thread Board. | Preserved infra | Medium with Annotation and Whiteboard. | Research |
| Movement language | Practice/CV | Lib concept | `axis-movement-language.ts`, `axis-movement-knowledge.ts` | Domain vocabulary for movement primitives. | Movement primitives/knowledge. | Current conversation primitive labels. | Preserved infra | Medium | Research |
| Motion blueprint | Practice | Lib concept | `axis-motion-blueprint.ts`, operating system | Structured show-me motion output. | Demonstration shape. | Evidence verdict. | Preserved infra | Medium | Research |
| Live coaching intervention | Practice | Lib concept | `axis-live-coach-renderer.ts`, operating system | Say-this/watch-for/next-rep-rule output. | Real-time cueing. | Current `/axis` reply. | Preserved infra | Medium | Research |
| Direction engine | Practice | Lib concept | `axis-direction-engine.ts`, operating system | Converts demonstration/practice to direction. | Action direction. | Thread Board Relationship label. | Preserved infra | Medium | Research |
| Environment layout | Practice/UI | Lib concept | `axis-environment-layout.ts`, operating system | Spatial setup derived from understanding. | Practice environment arrangement. | Current UI layout. | Preserved infra | Medium | Research |
| Observation engine | Understanding | Lib concept | `axis-observation-engine.ts`, operating system | Updates understanding from observations. | Learning update and confidence delta. | Active conversation route. | Preserved infra | Medium | Research |
| Evidence comparison | Evidence | Lib concept | `axis-evidence-comparison.ts`, operating system | Compares observation/evidence to understanding. | Match/mismatch evaluation. | Board rendering. | Preserved infra | Medium | Research |
| Real-time Axis | Voice/Camera | Lib concept | `axis-real-time.ts`, operating system | Combines voice, observations, CV into live intervention. | Real-time observations and coaching. | Current MVP. | Preserved infra | Medium | Research |
| Axis Operating System | Foundation/Infrastructure | Lib concept | `axis-operating-system.ts`, docs/archive | Pipeline from understanding to demo, practice, evidence, comparison, coaching. | Old integrated runtime. | Active conversation page. | Preserved infra | High with active Axis. | Research or archive |
| Tell me / Show me / Watch this / Try this / Show me again | Practice | Sequence | `axis-operating-system.ts` | Old coaching sequence output. | Coaching progression. | Thread Board schema. | Preserved infra | Medium | Research |
| Research API | API | API capability | research API | Turns raw search results into discovery statements. | Research synthesis. | Current product research. | Preserved infra | Medium | Research |
| Dataset builder | CV/Infrastructure | API/lib capability | dataset-builder API/lib | Build CV/data datasets. | Dataset construction. | Active product. | Preserved infra | Low | Research |
| Debug routes | Infrastructure | API routes | ball-debug, frame-debug, decoder-test routes | Diagnostic/test endpoints. | Development debugging. | Product UI. | Preserved infra | Low | Keep infra |
| Cloud store | Infrastructure | Lib | `axis-cloud-store.ts` | Cloud storage helper. | Stored media/artifacts. | Conversation state. | Preserved infra | Low | Keep infra |
| Supabase server/client auth | Infrastructure | Lib | `axis-supabase-server.ts`, `axis-client-auth.ts`, `axis-request-auth.ts` | Auth and server client helpers. | Auth/request identity. | Product concepts. | Preserved infra | Low | Keep infra |
| Trigger.dev jobs | Infrastructure | Docs/config/repo cleanup | Trigger docs, video job code | Background processing. | Async job execution. | Axis product meaning. | Preserved infra | Low | Keep infra |
| Cloudflare Stream | Video/Infrastructure | Docs, video job libs | Video storage/streaming. | Video pipeline hosting. | Conversation product. | Preserved infra | Low | Keep infra |
| Cartridges | Infrastructure/Practice | `docs/axis/CARTRIDGE_TEMPLATE.md` | Domain plugin bundle of dimensions, experiments, constraints, witnesses. | Domain-specific extension shape. | Active `/axis` page. | Research candidate | Medium | Research |
| Cartridge dimensions | Practice/Evidence | Cartridge template | Gaze, spacing, dribble count, footwork, body position, contact, release point. | Observable domain dimensions. | Whole coaching model. | Research candidate | Medium | Research |
| Service MCP slots | Infrastructure | `docs/axis/repo-evaluation.md` | Potential external service connectors. | Integration architecture. | Active product scope. | Research candidate | Low | Research |
| Codegraph workflow | Infrastructure | Agent/plugin docs | `.agents`, `docs/axis/repo-evaluation.md` | Query workflow for code understanding. | Developer tooling. | Product UX. | Preserved tooling | Low | Keep |
| Product gate | Infrastructure | Agent skill | `.agents/skills/product-gate` | Internal review/gating skill. | Development process. | User product. | Preserved tooling | Low | Keep |
| Taste skill dials | Foundation/Tooling | `docs/axis/repo-evaluation.md` | Evaluation dials from imported agent patterns. | Agent/product evaluation heuristics. | Active Axis product concept. | Research candidate | Medium | Research |
| Development Architect | Foundation/Legacy | `docs/axis-core.md`, archive | Older identity: Axis issues objectives, constraints, memory, next objectives. | Former product role. | Current conversation MVP. | Legacy/historical | High with current Axis. | Archive |
| Core loop | Foundation/Legacy | `docs/axis-core.md`, archive | Prompt, objective, constraint, action, reality, capture, context, memory, evaluation, next objective. | Old runtime loop. | Current conversation flow unless revalidated. | Legacy/historical | High | Archive/research |
| Signal Stack | Voice/Camera/Memory | Legacy architecture | `docs/axis-core.md`, archive | Camera, microphone, speaker, memory roles. | Multimodal architecture. | Current MVP. | Legacy/historical | Medium | Archive/research |
| Surface hierarchy | Hierarchy | Legacy UI/product idea | archive, AGENTS legacy, cleanup docs | Ordered set of product surfaces. | Old navigation/product architecture. | Current `/axis` one-surface page. | Legacy | High with active route. | Archive |
| Perception hierarchy | Hierarchy/CV | Legacy architecture | archive docs | Layered perception model. | CV/meaning pipeline. | Active Thread Board. | Legacy/historical | Medium | Research |
| Connection graph | Hierarchy/Memory | Legacy concept | archive docs | Graph of relationships/connections. | Old knowledge architecture. | Current Thread Board. | Legacy | High with graph ban. | Archive |
| Recursion pipeline | Infrastructure/Legacy | Archive | Old recursive runtime architecture. | Runtime orchestration idea. | Active conversation. | Legacy | Medium | Archive |
| World model / world rules | Foundation/Legacy | Archive | Broader model of domain reality. | Old reasoning architecture. | Current conversation. | Legacy | Medium | Archive/research |
| Language system / trigger lexicon | Prompt/Legacy | Archive | Controlled language and trigger phrases. | Old prompt/vocabulary governance. | Active prompt unless ported. | Legacy | Medium | Research |
| Progressive disclosure | UI/Legacy | Archive | Revealing complexity gradually. | Old UI strategy. | Current layout unless explicitly used. | Legacy | Low | Research |
| Accountability system | Mission/Legacy | Archive | Keeping user accountable through loops. | Old motivational product layer. | Current conversation. | Legacy | Medium | Archive |
| Team memory | Memory/Legacy | Archive | Shared group memory. | Team-level history. | Current MVP. | Legacy | Medium | Archive/research |
| Warmup system | Practice/Legacy | Archive | Warmup philosophy/system. | Practice prep flow. | Current Axis. | Legacy | Low | Archive |
| Spurt / stress phases / surface situations | Practice/Game/Legacy | Archive | Older game/practice vocabulary. | Domain-specific situations. | Current MVP. | Legacy | Medium | Archive/research |

## Notes

- The active product is narrow: `/axis` plus `/api/axis/conversation`.
- The repo contains a large preserved Axis architecture that is not active: missions, challenges, evidence upload, CV, video jobs, replay, operating system, player model, and Supabase thread memory.
- The largest naming collision is `Understanding`: it appears as active board organization, an old structured model (`AxisUnderstanding`), and a broad product principle.
- The second largest naming collision is `Board`: current Thread Board, future standalone Whiteboard, historical dashboard/mission/card surfaces, and user-requested dry-erase whiteboard language.
