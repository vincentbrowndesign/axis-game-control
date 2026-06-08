# AXIS_ENGINEERING_CONSTITUTION.md

## Purpose

Axis exists to create replay overlays from sports video.

Every engineering decision must optimize for:

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

If a change does not improve this flow, it should be questioned.

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

# Rule 4 - Product First

Every feature begins with:

"What does the user see?"

Not:

"What database table do we need?"

Examples:

GOOD

Player Ring
Ball Trail
Replay Export

BAD

Schema First
Infrastructure First
Analytics First

---

# Rule 5 - Architecture Must Fit On One Page

Any engineer should be able to draw Axis from memory.

Current MVP:

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

If a system can be removed without hurting:

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

it should be considered for removal.

---

# Rule 10 - Overlay Quality Over Feature Count

Axis wins through presentation.

Priority order:

1. Identity

   * Player Ring
   * Player Label

2. Motion

   * Ball Trail
   * Pass Trail

3. Replay Polish

   * Slow Motion
   * Freeze Frame
   * Zoom

4. Understanding

   * Pressure
   * Advantage
   * Spacing

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

The first viewer reaction should be:

"That is my kid. That looks good."

Not:

"Interesting analytics."
