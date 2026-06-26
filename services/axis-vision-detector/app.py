from __future__ import annotations

import base64
import os
from io import BytesIO
from pathlib import Path
from typing import Any

runtime_cache_dir = os.environ.get("AXIS_DETECTOR_CACHE_DIR", "/tmp")
os.environ.setdefault("MPLCONFIGDIR", os.path.join(runtime_cache_dir, ".tmp-matplotlib"))

from fastapi import FastAPI, HTTPException
import numpy as np
import onnxruntime as ort
from pydantic import BaseModel
from PIL import Image


COCO_CLASS_NAMES = {
    0: "person",
    32: "sports ball",
}

AXIS_TYPE_BY_CLASS = {
    0: "player",
    32: "ball",
}

IMAGE_SIZE = 640
MODEL_NAME = os.environ.get("AXIS_YOLO_MODEL", str(Path(__file__).with_name("yolo11n.onnx")))
CONFIDENCE = float(os.environ.get("AXIS_YOLO_CONFIDENCE", "0.25"))
IOU_THRESHOLD = float(os.environ.get("AXIS_YOLO_IOU", "0.45"))

app = FastAPI(title="Axis Vision Detector", version="0.1.0")
session: ort.InferenceSession | None = None


class DetectRequest(BaseModel):
    imageDataUrl: str
    confidenceThreshold: float | None = None
    frameId: str | int | None = None
    timestamp: float | int | None = None


def get_session() -> ort.InferenceSession:
    global session
    if session is None:
        session = ort.InferenceSession(MODEL_NAME, providers=["CPUExecutionProvider"])
    return session


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_NAME,
        "runtime": "onnxruntime",
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
    detector = get_session()
    input_name = detector.get_inputs()[0].name
    output = detector.run(None, {input_name: prepare_image(image)})[0]
    detections = decode_yolo_output(output, width, height, payload.confidenceThreshold)

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


def prepare_image(image: Image.Image) -> np.ndarray:
    resized = image.resize((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.BILINEAR)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    return np.transpose(array, (2, 0, 1))[None, :, :, :]


def decode_yolo_output(
    output: np.ndarray,
    image_width: int,
    image_height: int,
    confidence_threshold: float | None = None,
) -> list[dict[str, Any]]:
    predictions = np.squeeze(output)
    if predictions.ndim != 2:
        return []

    if predictions.shape[0] == 84:
        predictions = predictions.T

    candidates: list[dict[str, Any]] = []
    x_scale = image_width / IMAGE_SIZE
    y_scale = image_height / IMAGE_SIZE

    threshold = CONFIDENCE if confidence_threshold is None else max(0.01, min(float(confidence_threshold), 0.99))

    for prediction in predictions:
        class_scores = prediction[4:]
        class_id = max(AXIS_TYPE_BY_CLASS, key=lambda key: float(class_scores[key]))
        confidence = float(class_scores[class_id])
        if confidence < threshold:
            continue

        center_x, center_y, width, height = [float(value) for value in prediction[:4]]
        box_width = width * x_scale
        box_height = height * y_scale
        x = (center_x * x_scale) - (box_width / 2)
        y = (center_y * y_scale) - (box_height / 2)

        candidates.append(
            {
                "bbox": {
                    "x": clamp(x, 0.0, float(image_width)),
                    "y": clamp(y, 0.0, float(image_height)),
                    "width": clamp(box_width, 0.0, float(image_width)),
                    "height": clamp(box_height, 0.0, float(image_height)),
                },
                "classId": class_id,
                "className": COCO_CLASS_NAMES[class_id],
                "confidence": confidence,
                "mappedType": AXIS_TYPE_BY_CLASS[class_id],
            }
        )

    return non_max_suppression(candidates)


def non_max_suppression(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    by_confidence = sorted(detections, key=lambda detection: float(detection["confidence"]), reverse=True)

    for detection in by_confidence:
        if all(iou(detection["bbox"], kept_detection["bbox"]) < IOU_THRESHOLD for kept_detection in kept):
            kept.append(detection)

    return kept


def iou(first: dict[str, float], second: dict[str, float]) -> float:
    first_x2 = first["x"] + first["width"]
    first_y2 = first["y"] + first["height"]
    second_x2 = second["x"] + second["width"]
    second_y2 = second["y"] + second["height"]

    inter_x1 = max(first["x"], second["x"])
    inter_y1 = max(first["y"], second["y"])
    inter_x2 = min(first_x2, second_x2)
    inter_y2 = min(first_y2, second_y2)
    inter_area = max(0.0, inter_x2 - inter_x1) * max(0.0, inter_y2 - inter_y1)
    if inter_area <= 0:
        return 0.0

    first_area = first["width"] * first["height"]
    second_area = second["width"] * second["height"]
    return inter_area / max(first_area + second_area - inter_area, 1e-9)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))
