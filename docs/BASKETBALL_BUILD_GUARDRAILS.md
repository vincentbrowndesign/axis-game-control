# Axis Basketball Build Guardrails

Purpose:
Protect the Axis Basketball build from fake progress, tactical clutter, premature court overlays, manual tagging, and unsupported AI claims.

## 1. Product Truth

Axis Basketball is:

```text
camera-first
body-first
pose-overlay-first
AI-body-feed-first
coach-review-after-AI
```

The correct MVP sequence is:

```text
turn Axis on
-> choose front or rear camera
-> camera opens
-> Axis reads the body
-> Axis tracks body landmarks
-> Axis generates simple body reads
-> Axis saves body context for AI later
```

Do not change this order unless the user explicitly asks.

## 2. Do Not Build In The MVP

Do not make the MVP about:

- court zones
- Delta offense
- shot charts
- horns
- 5-out
- spacing shapes
- tactical overlays
- manual live tagging buttons
- coach tag panels
- fake AI event panels
- automatic stat claims
- make/miss automation
- clip generation buttons
- dashboards full of fake data

These may exist as future notes only.

## 3. Body Tracker Rules

The first useful screen should be:

```text
Start Body Session
Choose Camera: Front / Rear
Turn On Camera
Step Into Frame
Body Detected
Pose Overlay Active
Body Read Active
```

Axis should use coach/player language:

- Body detected
- Reading stance
- Reading balance
- Step fully into frame
- Move camera back
- Need more light
- Pose confidence low
- Body read active

Do not show internal language like:

- pose_json
- landmark index
- metadata
- model inference
- AI candidate
- database row

## 4. Simple Reads Only

Show readable outputs:

- Stance
- Balance
- Knee Bend
- Hip Level
- Shoulder Level
- Torso Lean
- Body Center
- Movement Quality

Use simple values:

- narrow / normal / wide
- balanced / left-heavy / right-heavy / forward / backward / unstable
- low / medium / high
- upright / forward lean / backward lean
- stable / unstable

Do not claim advanced reads until implemented.

## 5. Data Rules

The AI will eventually learn from:

```text
video
+ pose landmark timeline
+ body read timeline
```

Early data should be body context:

- timestamp
- camera facing
- body detected
- landmark coordinates
- landmark confidence
- body center
- shoulder line angle
- hip line angle
- spine angle
- torso lean
- stance width
- balance estimate
- knee angles
- hip angles
- elbow angles
- movement deltas

Court overlay configs are future-layer context, not MVP context.

## 6. No Hallucination Rules

Before creating or editing code:

1. Inspect the existing project structure.
2. Reuse existing patterns.
3. Do not claim a feature is working unless it is actually wired.
4. Do not say "AI detects" unless there is real AI code.
5. Do not say "saved" unless data is actually persisted or clearly local.
6. If uncertain, write a limitation instead of pretending.

Use this wording when needed:

```text
Not implemented yet.
Future phase.
Requires camera permission.
Requires better light.
Requires persistent storage later.
Requires AI worker later.
```

## 7. UI Rules

Axis Basketball UI should feel like a sideline body-reading tool.

Rules:

- mobile-first
- iPhone/iPad first
- big tap targets
- minimal text
- dark/simple camera-first layout
- pose overlay above live camera
- no crowded dashboards
- no fake activity feeds
- no fake insights
- no stat cards until real data exists

## 8. Final Guardrail

Axis Basketball MVP must stay:

```text
simple
real
camera-first
body-first
pose-overlay-first
AI-body-feed-first
no court overlay MVP
no manual tagging first
no fake AI
```
