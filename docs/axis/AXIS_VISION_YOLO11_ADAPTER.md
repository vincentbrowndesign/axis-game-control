# Axis Vision YOLO11 Adapter

Status: v0

Axis Vision uses YOLO11n as the first server-side detector bridge for the core objects:

```text
Find the player.
Find the rim.
Find the ball.
```

## What It Does

The adapter lets `/axis/vision` send camera frames to `/api/axis/vision/detect`.

The API route saves a temporary image, runs `scripts/axis_vision_yolo11_detect.py`, parses JSON output, and returns normalized Axis detections that the existing Vision tracker can use.

Product mode stays clean. Debug details stay behind the Debug toggle.

## Detector

Default model:

```text
yolo11n.pt
```

Override model:

```text
AXIS_YOLO_MODEL=/path/to/model.pt
```

Python binary override:

```text
AXIS_PYTHON_BIN=/path/to/python
```

## Label Mapping

YOLO11 COCO classes:

| COCO class | COCO name | Axis type |
|---|---|---|
| 0 | person | player |
| 32 | sports ball | ball |

## Rim Boundary

Rim is manual-lock only in v0.

YOLO11 does not detect the rim yet. The user locks the rim in `/axis/vision`, and Axis keeps that rim stable until the user changes it.

## Install

```bash
python -m pip install -U ultralytics
```

## Test Commands

```bash
python -c "import ultralytics; print(ultralytics.__version__)"
```

```bash
yolo checks
```

```bash
yolo predict model=yolo11n.pt source=0 show=True classes=0,32
```

## Axis Boundary

Do not turn this into full game stats, 10-player tracking, or an analytics dashboard.

YOLO11 raw detection is useful only when it helps Axis create searchable memory, useful evidence, correction learning, or next-session planning.
