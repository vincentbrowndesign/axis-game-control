Status: ARCHIVE

Why moved: older video/replay/CV engineering framing; current active gate lives in AGENTS and the docs index.

Current replacement source: `AGENTS.md` and `docs/AXIS_INDEX.md`

---

# AXIS_ENGINEERING_CONSTITUTION.md

---

> **LEGACY / FUTURE INFRASTRUCTURE CONTEXT**
>
> This document describes Axis as a video overlay / replay / CV product.
> That framing applies to preserved infrastructure in `src/lib/` and `src/app/api/axis/` (non-conversation routes).
>
> **The current active MVP is Axis Conversation at `/axis`.**
> Do not use this document to redirect the active `/axis` page into a dashboard, video system, mission tracker, or overlay product.
>
> Engineering rules 1–3, 6–8, and 11 are timeless and apply to the current MVP.
> The Purpose section and rules 4, 5, 9, 10 describe the video/overlay infrastructure layer.
>
> Current source of truth: `docs/AXIS_CONVERSATION_MVP.md`

---

## Purpose (Legacy — Video/Overlay Infrastructure)

Axis overlay infrastructure exists to create replay overlays from sports video.

The video pipeline optimizes for:

```text
Video
->
Detection
->
Tracking
->
Overlay
->
Export
```

This pipeline lives in `src/lib/` and `src/app/api/axis/` (non-conversation routes).
It is preserved infrastructure. It is not the active MVP surface.

If a change to the video/overlay layer does not improve this flow, it should be questioned.

---

# Rule 1 - Understanding Before Merging

No code may be merged unless it can be explained in plain English.

Every pull request must answer:

* What does this do?
* Why does it exist?
* Where is it used?

If the author cannot explain it, it does not ship.

---

# Rule 2 - Smallest Possible Solution

Always choose:

* fewer files
* fewer abstractions
* fewer dependencies
* fewer moving parts

Prefer:

```ts
function renderBallTrail()
```

over:

```ts
BallTrailManager
OverlayRegistry
RenderPipelineFactory
```

unless a real problem requires it.

---

# Rule 3 - No Abstractions Before Duplication

Do not create:

* managers
* registries
* factories
* providers
* event systems

until the same logic has been duplicated at least 3 times.

Duplicate twice.

Abstract third.

---

# Rule 4 - Product First (Timeless)

Every feature begins with:

"What does the user see?"

Not:

"What database table do we need?"

For the **Axis Conversation MVP**, "what the user sees" is a clean conversation page.
For the **video/overlay infrastructure**, examples are: Player Ring, Ball Trail, Replay Export.

---

# Rule 5 - Architecture Must Fit On One Page

Any engineer should be able to draw Axis from memory.

**Current Conversation MVP architecture:**

```text
User types
->
POST /api/axis/conversation
->
Claude (Axis system prompt)
->
Reply displayed in thread
```

**Legacy video/overlay infrastructure architecture:**

```text
Select Video
->
Upload
->
Frames
->
Detection
->
Tracking
->
Overlay
->
Export
```

If the architecture cannot fit on one page, it is too complicated.

---

# Rule 6 - No Invisible Systems

Every new system must justify its existence.

If introducing:

* Service
* Manager
* Provider
* Controller
* Registry
* Adapter
* Factory

the PR must explain:

1. Why it exists
2. What problem it solves
3. Why a direct function would not work

---

# Rule 7 - Optimize For A Solo Founder

Axis is not maintained by 50 engineers.

Every design choice must assume:

* one primary maintainer
* limited time
* limited debugging bandwidth

Understanding beats cleverness.

---

# Rule 8 - AI Is A Draft, Not An Authority

AI-generated code is a first draft.

Before merging:

* simplify it
* remove abstractions
* remove unused layers
* remove unnecessary configuration

The goal is ownership, not generation.

---

# Rule 9 - Every PR Must Answer

What can be deleted?

**For Axis Conversation MVP:** if a change does not improve the conversation experience, it should be questioned.

**For video/overlay infrastructure:** if a system can be removed without hurting the Video → Detection → Tracking → Overlay → Export flow, it should be considered for removal.

---

# Rule 10 - Quality Over Feature Count (Video/Overlay Infrastructure)

> This rule applies to the video/overlay infrastructure layer, not the active Axis Conversation MVP.

When working on video overlay infrastructure, priority order is:

1. Identity — Player Ring, Player Label
2. Motion — Ball Trail, Pass Trail
3. Replay Polish — Slow Motion, Freeze Frame, Zoom
4. Understanding — Pressure, Advantage, Spacing

Do not build interpretation layers before identity and motion feel premium.

---

# Rule 11 - Before Writing Code

Every major implementation must follow:

1. Explain architecture
2. Explain tradeoffs
3. Explain maintenance burden
4. Explain simplest version
5. Then write code

Code is the last step, not the first.

---

# Success Metric

**Axis Conversation MVP:**
The first user reaction should be: "That actually moved the work forward."
Not: "Interesting AI assistant."

**Video/Overlay infrastructure:**
The first viewer reaction should be: "That is my kid. That looks good."
Not: "Interesting analytics."
