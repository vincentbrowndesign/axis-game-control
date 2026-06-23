Status: REFERENCE

Why moved: useful audit material, but not current build direction.

Current replacement source: `docs/AXIS_INDEX.md`

---

# Axis Duplication Risks

Audit date: 2026-06-18

This file lists concepts that may overlap or fight each other in the current repo. It does not propose a new product vision. It only records boundaries that should stay explicit while the active MVP remains `/axis` conversation plus passive Thread Board.

| Pair | What overlaps | What must stay separate | Recommended boundary |
|---|---|---|---|
| Conversation vs Chat | Both describe message exchange between user and Axis. | Conversation is the product behavior and source of understanding. Chat is only the generic UI/mechanic. | Use Conversation for product language. Use chat only when referring to generic message mechanics or third-party patterns. |
| Thread Board vs Whiteboard | Both organize a thread into sections. Both use board/whiteboard language and generated structure. | Thread Board is active inline/passive output from `/api/axis/conversation`. Whiteboard is preserved future standalone renderer/API. | Keep Thread Board active. Keep Whiteboard files future-only until a deliberate migration reconciles schemas. |
| Hierarchy vs Understanding | Both can organize meaning. Legacy docs include surface/perception/connection hierarchy; active flow uses understanding primitives. | Hierarchy is architecture or structure. Understanding is what Axis extracts from conversation. | Do not expose hierarchy as a user-facing model in `/axis`. Use understanding sections for current output. |
| Evidence vs Observation | Both can state what happened. Evidence can be a count, clip, presence, note, upload, or witness result; Observation is a noticed fact/signal. | Evidence supports or verifies. Observation names what was noticed. | Observations can cite evidence, but evidence should not become its own active graph or board in the MVP. |
| Mission vs Challenge | Both include objectives, constraints, attempts, and evidence. | Mission carries session/memory/outcome mechanics. Challenge is a practice task/objective with a constraint. | Treat both as preserved legacy/practice infrastructure unless reactivated intentionally. Do not mix mission language into active `/axis`. |
| Annotation vs Sketch | Both add visual meaning. Annotation marks or labels existing content; Sketch generates a diagram. | Annotation is commentary/marginalia. Sketch is a visual artifact or SVG/diagram. | Keep both inactive in MVP. If revived, annotations should support text/board meaning; sketches should be explicit generated artifacts. |
| Memory vs History | Both refer to prior information. History can be current chronological messages; Memory can persist across sessions, players, or missions. | Current `/axis` history is browser/session conversation state. Memory implies longer-term storage and recall. | Call current active state conversation history. Use memory only for preserved/player/mission/Supabase systems or a future consented design. |
| Camera vs Evidence | Camera can produce evidence, observations, or witness verdicts. | Camera is a modality/source. Evidence is the supporting material or proof. | Keep camera as input/source. Do not make camera synonymous with proof or current product value. |
| Voice vs Conversation | Voice can capture spoken input and produce observations. Conversation is the core product interaction, currently typed. | Voice is a modality. Conversation is the work-development loop. | Keep voice inactive/preserved. If revived, voice should feed conversation, not replace the conversation model. |
| Dashboard vs Board | Both can display organized information. Dashboard implies metrics/panels/monitoring; Board implies current thread understanding. | Dashboard is explicitly excluded from active MVP. Thread Board is passive organization of the current conversation. | Avoid dashboard panels, metrics, and sidebar summaries on `/axis`. Keep board scoped to title, summary, and sections. |
| Tool vs Layer | Tools are capabilities users or systems use; layers are product/architecture boundaries. Placeholder whiteboard tools were removed; many old API capabilities remain. | A tool should not imply an active product layer. A layer should not imply manual user controls. | Treat preserved APIs/libs as infrastructure until intentionally surfaced. Do not add manual board tools to `/axis`. |
| Thread Board vs AxisUnderstanding | Both organize meaning from a thread. | Thread Board is the active user-facing display schema. AxisUnderstanding is a preserved structured model with concept, focus, belief, confidence, patterns, cue, experiment, and evidence request. | Do not expose AxisUnderstanding directly in the active UI. Reconcile schemas before wiring `understand`/`run` back in. |
| Pattern vs Relationship | Both can describe connections among ideas or behaviors. | Pattern is recurrence or tendency. Relationship is connection, dependency, or influence. | Use Pattern when repetition is the point. Use Relationship when the linkage between things is the point. |
| Hypothesis vs Belief | Both can be uncertain statements. | Hypothesis is testable and provisional. Belief is a stored statement with status/confidence in older memory models. | Use Hypothesis in Thread Board. Use Belief only inside preserved memory/player systems unless redesigned. |
| Intervention vs Challenge | Both can tell the user what to do next. | Intervention is a next move/cue within understanding. Challenge is an objective/constraint/evidence object. | Keep Thread Board intervention lightweight. Do not convert it into mission/challenge mechanics without product decision. |
| Outcome / Next Move vs MissionMoment | Both describe result or next step. | Outcome / Next Move is a board section. MissionMoment is a legacy mission status such as ALMOST, COMPLETE, FAILED, RECORD, STREAK. | Keep mission statuses out of active Thread Board unless missions are intentionally reactivated. |
| Witness vs Evidence | Both support claims. | Witness is a source or modality that creates a verdict/claim. Evidence is the material or value being used as support. | A witness may produce evidence, but evidence remains tied to the section or claim it supports. |
| CV Event vs Thread Event | Both are named `AxisEvent` in different layers. | CV event is movement/action semantics from tracking. Thread event is stored user/assistant content. | Avoid treating `AxisEvent` as one universal type. Rename or namespace if these systems converge. |
| Replay vs Review Session | Both inspect prior action. | Replay is playback/reconstruction. Review session is interpretation and notes. | If revived, replay should be evidence media; review session should organize what was learned from it. |
| Cards vs Sections | Both break information into chunks. | Cards are old modular UI artifacts. Sections are current board primitives. | Do not reintroduce response cards on `/axis`. Use sections for Thread Board organization. |
| Sidebar Threads vs Transcript Column | Both involve conversation navigation/display. | Sidebar Threads are old navigation/history. Transcript Column is current active thread display. | Keep the active page as one thread surface. Do not add thread sidebar until current MVP scope changes. |
| Player Model vs Current Thread | Both can identify strengths, bottlenecks, questions, and evidence. | Player Model is cross-thread/person-level memory. Current Thread is local conversation. | Do not let player model leak into `/axis` without explicit long-term memory design. |
| Behavioral System vs Product Direction | Both evaluate what features should do. | Behavioral System is preserved analysis infrastructure. Current product direction is defined by README/CLAUDE/AGENTS and MVP docs. | Do not use behavioral domains to justify excluded features like leaderboard or check-in without new direction. |
| Whiteboard internal primitives vs Thread Board primitives | Both describe understanding categories. | Whiteboard internals include Points, Relationships, Groups, Time, Evidence, States, Changes. Thread Board exposes Observation, Pattern, Relationship, Question, Hypothesis, Intervention, Outcome. | Reconcile before any shared renderer/API. Do not expose Point, State, Group, or Direction in current Thread Board. |
| Dry erase board language vs Manual whiteboard app | Both use whiteboard metaphors. | Dry erase language means organized sections, bullets, dividers, notes. Manual app means tools, drawing, draggable objects. | Keep visual language passive/generated. Do not add draw/text/box/arrow tools unless product direction changes. |

## Highest Risk Areas

- Thread Board and Whiteboard are close enough that future edits could accidentally reintroduce the old toggle or separate workspace.
- Evidence, Observation, Witness, Camera, and CV all touch proof. Without boundaries, they can become an evidence database instead of supporting organized understanding.
- Mission, Challenge, Intervention, Outcome, and Next Move all describe action. The active MVP should keep action language lightweight and avoid reviving mission mechanics.
- Memory, History, Player Model, Development Memory, and Supabase thread storage all describe prior context. The active MVP currently has only current-session history.
- Cards, Dashboard, Sidebar Threads, and Board all display organized information. The active route should remain one conversation surface plus passive Thread Board.
