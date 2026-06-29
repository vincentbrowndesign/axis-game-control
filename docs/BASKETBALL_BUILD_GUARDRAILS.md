# Axis Basketball Build Guardrails

Purpose:
Protect Axis Basketball from fake progress, tactical clutter, upper-body-only reads, premature court work, manual tagging, and unsupported AI claims.

## 1. Product Truth

Axis Basketball MVP is:

```text
full-body-first
camera-first
pose-overlay-first
full-body frame gate first
AI body feed later
```

The correct MVP sequence is:

```text
turn Axis on
-> choose front or rear camera
-> camera opens
-> Axis checks full body visibility
-> Axis tracks full-body pose landmarks
-> Axis reads body structure, base, balance, and movement
-> Axis creates full-body context for AI later
```

Do not call the read active unless the full body is visible.

## 2. Full Body Gate

Required full-body landmarks:

- head
- shoulders
- elbows
- wrists
- hips
- knees
- ankles
- heels / feet / toes if available

Use these states:

- No body detected
- Upper body only
- Lower body missing
- Feet missing
- Partial body read
- Move back for full body
- Full body detected
- Full body read active

If lower body or feet are missing, do not show full-body reads.

## 3. Do Not Build In The MVP

Do not make the MVP about:

- court overlays
- court zones
- shot charts
- spacing
- Delta offense
- manual tags
- clip generation first
- fake AI events
- reviewed AI event dashboards
- upper-body-only body reads
- fake stats

## 4. Full Body Reads Only

Show only:

- Frame
- Stance
- Balance
- Knee Bend
- Hip Level
- Shoulder Level
- Torso Lean
- Base
- Movement Quality

Use simple values:

- full body / partial body / no body
- narrow / normal / wide
- balanced / left-heavy / right-heavy / forward / backward / unstable
- low / medium / high
- level / tilted left / tilted right
- upright / forward lean / backward lean
- stable / unstable

Do not claim advanced biomechanics yet.

## 5. Data Rules

The AI will eventually learn from:

```text
video
+ full-body landmark timeline
+ full-body frame status
+ body read timeline
```

Early data should be full-body context:

- timestamp
- camera facing
- body detected
- full body visible
- upper body visible
- lower body visible
- feet visible
- landmark coordinates
- landmark visibility
- body center
- shoulder line angle
- hip line angle
- spine angle
- stance width
- balance estimate
- joint angles
- movement deltas
- read notes

## 6. UI Rules

Axis Basketball UI should feel like a sideline full-body reading tool.

Rules:

- mobile-first
- iPhone/iPad first
- camera view is the main product
- big tap targets
- minimal text
- pose overlay above live camera
- no court diagrams
- no tactical buttons
- no manual tags
- no clip buttons
- no fake AI stats

## 7. Final Guardrail

Axis Basketball MVP must stay:

```text
full-body-first
camera-first
pose-overlay-first
full-body frame gate first
AI body feed later
no court MVP
no manual tagging MVP
no fake AI
```
