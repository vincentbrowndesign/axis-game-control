# Axis Measure Source Registry v0

Status: ACTIVE LAB REFERENCE

Axis Measure is the CV and measurement layer. It is not full basketball analytics yet.

Current product truth:

```text
Player + Ball + Rim lock system
```

Core objects:

- player
- ball
- rim

This registry tracks sources that may sharpen Axis Measure. Dataset work belongs in the Measure/Lab layer. It should not turn the main Axis session product into a raw detector dashboard.

## Registry Fields

Each source tracks:

- name
- type: dataset | repo | API | paper | internal
- target object: player | ball | rim | relationship | pose | tracking
- use now / use later
- license risk
- install/setup effort
- expected product value
- notes

## Categories

1. Player detection/tracking
2. Ball detection/tracking
3. Rim/hoop detection and manual calibration
4. Pose/body landmarks
5. Multi-object tracking
6. Basketball skill/video datasets
7. APIs/tools already available in Axis
8. Axis-owned training data from live sessions

## Product Boundary

Use sources only when they improve the current lock system:

```text
Find the player.
Set the rim.
Find the ball.
Keep the overlay stable.
```

Do not promote a source just because it can produce raw analytics. Axis Measure v0 should sharpen object locks, reduce false boxes, stabilize tracking, and support manual rim truth.

## Initial Registry

| Name | Category | Type | Target object | Use | License risk | Setup effort | Expected product value | Notes |
|---|---|---|---|---|---|---|---|---|
| YOLO11 / COCO person + sports ball | Player detection/tracking | API | player | use now | medium | low | Baseline player and ball visibility for the current Player + Ball + Rim lock system. | Current detector foundation. Use COCO class 0 person as player and class 32 sports ball as ball. It does not detect rim. |
| TrackID3x3 | Multi-object tracking | dataset | tracking | use later | review required | medium | Reference material for stable player IDs in small-sided basketball footage. | Basketball-focused tracking source. Useful later for multi-player identity stability, but not needed for the current single-player default. |
| SportsMOT | Multi-object tracking | dataset | tracking | use later | review required | medium | Sports tracking benchmark for stronger player-track matching and missed-detection handling. | General sports MOT source. Good reference for tracking logic, occlusion, and ID stability beyond the v1 lock flow. |
| DeepSportLab | Basketball skill/video datasets | dataset | relationship | use later | review required | high | Basketball scene understanding references after Axis Measure is reliable on player, ball, and rim locks. | Treat as research/reference until source files, label schema, and license terms are reviewed. |
| DeepSportradar | Basketball skill/video datasets | paper | relationship | use later | review required | high | Potential reference for basketball broadcast-style detection and tracking workflows. | Treat as research/reference. Confirm public availability, annotations, and allowed use before any training or product dependency. |
| Roboflow Universe / RF100 | Player detection/tracking | dataset | player | use later | review required | medium | Fast source discovery for object datasets that may improve player, ball, or gym-context detection. | Useful for discovery and benchmarking. Every dataset has its own terms, so license review is required before training. |
| BASKET skill dataset | Basketball skill/video datasets | dataset | relationship | use later | review required | high | Later reference for basketball skill clips once Axis Measure graduates beyond object lock. | Useful later for skill-video organization. Not a v0 dependency because Axis Measure is not full basketball analytics yet. |
| Axis session camera captures | Axis-owned training data from live sessions | internal | player | use now | low | medium | Best private source for real Axis gym lighting, camera angles, players, and balls. | Use only when captured with user permission and reviewed. This is the main source for product-specific sharpening. |
| Axis manual rim locks | Axis-owned training data from live sessions | internal | rim | use now | low | low | Ground truth for manual rim placement, rim anchor UX, and future hoop detection evaluation. | Current rim truth should come from manual locks, not detector claims. |
| Axis accepted/rejected boxes | Axis-owned training data from live sessions | internal | tracking | use now | low | medium | Improves box filtering by learning what users accept and reject in real gyms. | Useful for reducing reflection/background false positives after explicit review. |
| Axis saved test frames | APIs/tools already available in Axis | internal | relationship | use now | low | low | Small repeatable frame set for regression checks before detector or overlay changes ship. | Use for smoke tests of player, ball, rim overlay behavior. Keep it small and reviewed. |

## Notes By Object

### Player

Use YOLO11/COCO now for baseline player detection. Use Axis-owned accepted/rejected boxes to reduce false positives from reflections, wall art, background people, and screen edges. Public tracking datasets are useful references, but the default product remains single-player.

### Ball

Use COCO sports ball now. Keep ball boxes hidden unless detected. Axis saved test frames should include hard cases: ball near shirt graphics, bright lights, floor reflections, and partial occlusion.

### Rim

Rim truth is manual-lock in v0. Axis manual rim locks are the highest-value source because they capture real user placement behavior. Do not wait for a detector to find the rim before the user can place it.

### Pose

Pose/body landmarks are use-later. They can help future footwork or body-position checks, but they should not complicate the current Player + Ball + Rim lock system.

### Tracking

Use simple stable tracking now: IoU, center-distance matching, short missed-frame tolerance, and smoothing. Use SportsMOT and TrackID3x3 as references before adding heavier tracking.

### Axis-Owned Data

Axis-owned reviewed data is the most important source because public datasets help Axis Measure see, but private Axis data teaches it what matters in real Axis sessions.
