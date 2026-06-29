#!/usr/bin/env python3
"""Axis Basketball visual detection worker.

This worker samples frames from a local recording, runs YOLO detection, and
writes a JSON manifest. It does not tag basketball events.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


DEFAULT_MODEL = "yolov8n.pt"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run YOLO detections on sampled video frames for Axis Basketball."
    )
    parser.add_argument("--video-path", required=True, help="Local path to a recording file.")
    parser.add_argument(
        "--output-json-path",
        required=True,
        help="Path where the detection JSON manifest should be written.",
    )
    parser.add_argument(
        "--sample-every-n-frames",
        type=int,
        default=15,
        help="Sample one frame every N frames. Defaults to 15.",
    )
    parser.add_argument(
        "--overlay-config-path",
        default=None,
        help="Optional JSON file containing the active overlay config/context.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"YOLO model path/name. Defaults to {DEFAULT_MODEL}.",
    )
    return parser.parse_args()


def load_overlay_context(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None

    overlay_path = Path(path)
    if not overlay_path.exists():
        raise FileNotFoundError(f"overlay config not found: {overlay_path}")

    with overlay_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def error_payload(code: str, message: str, overlay_context: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
        },
        "overlay_context": overlay_context,
        "detections": [],
    }


def run_detection(
    video_path: Path,
    output_json_path: Path,
    sample_every_n_frames: int,
    overlay_context: dict[str, Any] | None,
    model_name: str,
) -> int:
    if sample_every_n_frames < 1:
        write_json(
            output_json_path,
            error_payload(
                "INVALID_SAMPLE_RATE",
                "sample_every_n_frames must be greater than 0.",
                overlay_context,
            ),
        )
        return 2

    if not video_path.exists():
        write_json(
            output_json_path,
            error_payload("MISSING_VIDEO", f"video not found: {video_path}", overlay_context),
        )
        return 2

    try:
        import cv2  # type: ignore
    except ImportError:
        write_json(
            output_json_path,
            error_payload(
                "OPENCV_IMPORT_FAILED",
                "OpenCV is not installed. Install opencv-python-headless.",
                overlay_context,
            ),
        )
        return 2

    try:
        from ultralytics import YOLO  # type: ignore
    except ImportError:
        write_json(
            output_json_path,
            error_payload(
                "ULTRALYTICS_IMPORT_FAILED",
                "Ultralytics is not installed. Install ultralytics.",
                overlay_context,
            ),
        )
        return 2

    try:
        model = YOLO(model_name)
    except Exception as exc:  # noqa: BLE001 - worker must serialize model-load failures.
        write_json(
            output_json_path,
            error_payload("MODEL_LOAD_FAILURE", str(exc), overlay_context),
        )
        return 2

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        write_json(
            output_json_path,
            error_payload("UNREADABLE_VIDEO", f"could not open video: {video_path}", overlay_context),
        )
        return 2

    fps = capture.get(cv2.CAP_PROP_FPS) or 0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    detections: list[dict[str, Any]] = []
    sampled_frame_count = 0
    frame_number = 0

    while True:
        ok, frame = capture.read()
        if not ok:
            break

        if frame_number % sample_every_n_frames != 0:
            frame_number += 1
            continue

        sampled_frame_count += 1
        timestamp_seconds = frame_number / fps if fps > 0 else 0

        try:
            results = model.predict(frame, verbose=False)
        except Exception as exc:  # noqa: BLE001 - worker must serialize inference failures.
            capture.release()
            write_json(
                output_json_path,
                error_payload("DETECTION_FAILURE", str(exc), overlay_context),
            )
            return 2

        for result in results:
            names = getattr(result, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue

            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                class_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                detections.append(
                    {
                        "frame_number": frame_number,
                        "timestamp_seconds": round(timestamp_seconds, 3),
                        "class_name": names.get(class_id, str(class_id)),
                        "confidence": round(confidence, 5),
                        "bbox_xyxy": [round(float(value), 2) for value in xyxy],
                    }
                )

        frame_number += 1

    capture.release()

    payload = {
        "ok": True,
        "model": model_name,
        "video": {
            "path": str(video_path),
            "fps": fps,
            "width": width,
            "height": height,
            "frame_count": frame_count,
        },
        "sample_every_n_frames": sample_every_n_frames,
        "sampled_frame_count": sampled_frame_count,
        "detection_count": len(detections),
        "empty_detections": len(detections) == 0,
        "overlay_context": overlay_context,
        "detections": detections,
    }
    write_json(output_json_path, payload)
    return 0


def main() -> int:
    args = parse_args()
    output_json_path = Path(args.output_json_path)

    try:
        overlay_context = load_overlay_context(args.overlay_config_path)
    except Exception as exc:  # noqa: BLE001 - worker must serialize input failures.
        write_json(
            output_json_path,
            error_payload("OVERLAY_CONTEXT_LOAD_FAILURE", str(exc), None),
        )
        return 2

    return run_detection(
        video_path=Path(args.video_path),
        output_json_path=output_json_path,
        sample_every_n_frames=args.sample_every_n_frames,
        overlay_context=overlay_context,
        model_name=args.model,
    )


if __name__ == "__main__":
    sys.exit(main())
