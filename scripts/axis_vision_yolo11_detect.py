#!/usr/bin/env python
"""Axis Vision YOLO11 detector adapter.

Outputs JSON only on stdout so the Next.js route can parse it safely.
"""

from __future__ import annotations

import contextlib
import json
import os
import sys
from pathlib import Path


COCO_CLASS_NAMES = {
    0: "person",
    32: "sports ball",
}

AXIS_TYPE_BY_CLASS = {
    0: "player",
    32: "ball",
}


def emit(payload: dict) -> None:
    print(json.dumps(payload, separators=(",", ":")))


def fail(message: str, code: int = 1) -> None:
    emit({"ok": False, "error": message})
    raise SystemExit(code)


def main() -> None:
    if len(sys.argv) < 2:
        fail("Image file path is required.")

    image_path = Path(sys.argv[1])
    if not image_path.exists() or not image_path.is_file():
        fail(f"Image file does not exist: {image_path}")

    model_name = os.environ.get("AXIS_YOLO_MODEL", "yolo11n.pt")

    try:
        from ultralytics import YOLO
        from PIL import Image
    except Exception as exc:
        fail(f"Ultralytics is unavailable: {exc}")

    try:
        with Image.open(image_path) as image:
            width, height = image.size

        with contextlib.redirect_stdout(sys.stderr):
            model = YOLO(model_name)
            results = model.predict(
                source=str(image_path),
                classes=[0, 32],
                conf=0.25,
                verbose=False,
                show=False,
            )

        detections = []
        if results:
            result = results[0]
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    class_id = int(box.cls[0].item())
                    if class_id not in AXIS_TYPE_BY_CLASS:
                        continue

                    x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
                    detections.append(
                        {
                            "bbox": {
                                "height": max(0.0, y2 - y1),
                                "width": max(0.0, x2 - x1),
                                "x": x1,
                                "y": y1,
                            },
                            "classId": class_id,
                            "className": COCO_CLASS_NAMES[class_id],
                            "confidence": float(box.conf[0].item()),
                            "mappedType": AXIS_TYPE_BY_CLASS[class_id],
                        }
                    )

        emit(
            {
                "ok": True,
                "image": {"height": height, "width": width},
                "detections": detections,
                "model": model_name,
            }
        )
    except Exception as exc:
        fail(f"YOLO11 detection failed: {exc}")


if __name__ == "__main__":
    main()
