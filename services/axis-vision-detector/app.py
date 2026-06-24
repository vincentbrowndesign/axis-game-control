from __future__ import annotations

import base64
import os
from io import BytesIO
from typing import Any

os.environ.setdefault("YOLO_CONFIG_DIR", os.path.join(os.getcwd(), ".tmp-ultralytics"))
os.environ.setdefault("MPLCONFIGDIR", os.path.join(os.getcwd(), ".tmp-matplotlib"))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO


COCO_CLASS_NAMES = {
    0: "person",
    32: "sports ball",
}

AXIS_TYPE_BY_CLASS = {
    0: "player",
    32: "ball",
}

MODEL_NAME = os.environ.get("AXIS_YOLO_MODEL", "yolo11n.pt")
CONFIDENCE = float(os.environ.get("AXIS_YOLO_CONFIDENCE", "0.25"))

app = FastAPI(title="Axis Vision Detector", version="0.1.0")
model: YOLO | None = None


class DetectRequest(BaseModel):
    imageDataUrl: str
    frameId: str | int | None = None
    timestamp: float | int | None = None


def get_model() -> YOLO:
    global model
    if model is None:
        model = YOLO(MODEL_NAME)
    return model


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_NAME,
        "classes": [0, 32],
        "maps": {
            "person": "player",
            "sports ball": "ball",
        },
    }


@app.post("/detect")
def detect(payload: DetectRequest) -> dict[str, Any]:
    image = decode_image_data_url(payload.imageDataUrl)
    width, height = image.size
    detector = get_model()

    results = detector.predict(
        source=image,
        classes=[0, 32],
        conf=CONFIDENCE,
        verbose=False,
        show=False,
    )

    detections: list[dict[str, Any]] = []
    if results:
        boxes = results[0].boxes
        if boxes is not None:
            for box in boxes:
                class_id = int(box.cls[0].item())
                if class_id not in AXIS_TYPE_BY_CLASS:
                    continue

                x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
                detections.append(
                    {
                        "bbox": {
                            "x": x1,
                            "y": y1,
                            "width": max(0.0, x2 - x1),
                            "height": max(0.0, y2 - y1),
                        },
                        "classId": class_id,
                        "className": COCO_CLASS_NAMES[class_id],
                        "confidence": float(box.conf[0].item()),
                        "mappedType": AXIS_TYPE_BY_CLASS[class_id],
                    }
                )

    return {
        "ok": True,
        "frameId": payload.frameId,
        "timestamp": payload.timestamp,
        "image": {
            "width": width,
            "height": height,
        },
        "model": MODEL_NAME,
        "detections": detections,
    }


def decode_image_data_url(image_data_url: str) -> Image.Image:
    if not image_data_url:
        raise HTTPException(status_code=400, detail="imageDataUrl is required.")

    if "," in image_data_url and image_data_url.startswith("data:image/"):
        _, encoded = image_data_url.split(",", 1)
    else:
        encoded = image_data_url

    try:
        image_bytes = base64.b64decode(encoded, validate=True)
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid imageDataUrl: {exc}") from exc

    return image
