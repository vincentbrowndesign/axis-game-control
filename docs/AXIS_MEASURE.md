# Axis Measure

Status: standalone CV product surface

Domain:

```text
axismeasure.com
```

Axis Measure is the CV and measurement product.

Axis is the main control and output layer.

Axis Measure can later feed Axis events and data, but it starts as its own clean product surface.

## Product Start

Axis Measure starts with:

- player detection
- rim manual lock
- ball detection
- clean product boxes
- separate debug mode

## Routes

```text
/ = Axis Measure home
/vision = live camera object lock
/calibrate = rim/manual calibration
/api/vision/detect = detector proxy
```

The existing Axis Vision route remains available at:

```text
/axis/vision
```

## Detection

Axis Measure uses YOLO11n through the local detector service.

COCO label mapping:

| COCO class | COCO name | Axis Measure object |
|---|---|---|
| 0 | person | player |
| 32 | sports ball | ball |

Rim is manual-lock only.

Axis Measure does not detect the rim with YOLO11n in v0.

## UI Rules

Axis Measure is mobile and iPad first.

The primary surface is a full camera screen.

Product mode stays clean:

- player boxes
- ball box
- manually locked rim
- bottom status for Player / Rim / Ball

Debug mode is separate and may show detector URL, errors, confidence, class IDs, and cadence.

## Product Boundary

Do not build:

- dashboards
- full game stats
- 10-player tracking
- noisy debug UI in product mode

Axis Measure measures basketball reality.

Axis turns basketball reality into control, output, session memory, and next-session planning.

Later, Axis Measure can feed Axis events and data once the integration boundary is intentional.
