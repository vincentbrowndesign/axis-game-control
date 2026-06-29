#!/usr/bin/env python3
"""Axis Basketball pose analysis worker.

Pose analysis supports AI tagging. It does not replace overlay context.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


LANDMARKS = {
    "left_shoulder": 11,
    "right_shoulder": 12,
    "left_elbow": 13,
    "right_elbow": 14,
    "left_wrist": 15,
    "right_wrist": 16,
    "left_hip": 23,
    "right_hip": 24,
    "left_knee": 25,
    "right_knee": 26,
    "left_ankle": 27,
    "right_ankle": 28,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze basketball pose landmarks.")
    parser.add_argument("--video-path", default=None, help="Optional local video path.")
    parser.add_argument("--frames-dir", default=None, help="Optional directory of sampled frame images.")
    parser.add_argument("--output-json-path", required=True, help="Output pose JSON path.")
    parser.add_argument("--sample-every-n-frames", type=int, default=15)
    parser.add_argument("--overlay-config-path", default=None)
    return parser.parse_args()


def load_json(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    json_path = Path(path)
    if not json_path.exists():
        raise FileNotFoundError(f"overlay config not found: {json_path}")
    with json_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def error_payload(code: str, message: str, overlay_context: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "ok": False,
        "error": {"code": code, "message": message},
        "overlay_context": overlay_context,
        "poses": [],
    }


def point(landmarks: Any, name: str) -> dict[str, float]:
    landmark = landmarks[LANDMARKS[name]]
    return {
        "x": round(float(landmark.x), 5),
        "y": round(float(landmark.y), 5),
        "visibility": round(float(landmark.visibility), 5),
    }


def distance(a: dict[str, float], b: dict[str, float]) -> float:
    return math.sqrt((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2)


def midpoint(a: dict[str, float], b: dict[str, float]) -> dict[str, float]:
    return {
        "x": round((a["x"] + b["x"]) / 2, 5),
        "y": round((a["y"] + b["y"]) / 2, 5),
    }


def angle_degrees(a: dict[str, float], b: dict[str, float]) -> float:
    return math.degrees(math.atan2(b["y"] - a["y"], b["x"] - a["x"]))


def collect_landmarks(raw_landmarks: Any) -> dict[str, Any]:
    shoulders = {
        "left": point(raw_landmarks, "left_shoulder"),
        "right": point(raw_landmarks, "right_shoulder"),
    }
    hips = {
        "left": point(raw_landmarks, "left_hip"),
        "right": point(raw_landmarks, "right_hip"),
    }
    knees = {
        "left": point(raw_landmarks, "left_knee"),
        "right": point(raw_landmarks, "right_knee"),
    }
    ankles = {
        "left": point(raw_landmarks, "left_ankle"),
        "right": point(raw_landmarks, "right_ankle"),
    }
    elbows = {
        "left": point(raw_landmarks, "left_elbow"),
        "right": point(raw_landmarks, "right_elbow"),
    }
    wrists = {
        "left": point(raw_landmarks, "left_wrist"),
        "right": point(raw_landmarks, "right_wrist"),
    }
    all_points = [
        *shoulders.values(),
        *hips.values(),
        *knees.values(),
        *ankles.values(),
        *elbows.values(),
        *wrists.values(),
    ]
    pose_confidence = sum(item["visibility"] for item in all_points) / len(all_points)

    return {
        "shoulders": shoulders,
        "hips": hips,
        "knees": knees,
        "ankles": ankles,
        "elbows": elbows,
        "wrists": wrists,
        "pose_confidence": round(pose_confidence, 5),
    }


def estimate_basketball_pose(pose: dict[str, Any]) -> dict[str, Any]:
    shoulders = pose["shoulders"]
    hips = pose["hips"]
    knees = pose["knees"]
    ankles = pose["ankles"]
    elbows = pose["elbows"]
    wrists = pose["wrists"]

    shoulder_width = distance(shoulders["left"], shoulders["right"])
    stance_width = distance(ankles["left"], ankles["right"])
    hip_center = midpoint(hips["left"], hips["right"])
    shoulder_center = midpoint(shoulders["left"], shoulders["right"])
    knee_center = midpoint(knees["left"], knees["right"])
    ankle_center = midpoint(ankles["left"], ankles["right"])

    knee_bend = max(0.0, min(1.0, (ankle_center["y"] - knee_center["y"]) * 2.5))
    torso_lean = angle_degrees(hip_center, shoulder_center)
    landing_balance = max(0.0, 1.0 - abs(hip_center["x"] - ankle_center["x"]) * 5)

    right_release_alignment = abs(wrists["right"]["x"] - elbows["right"]["x"])
    left_release_alignment = abs(wrists["left"]["x"] - elbows["left"]["x"])
    release_side_alignment = max(
        0.0,
        1.0 - min(right_release_alignment, left_release_alignment) * 6,
    )

    notes: list[str] = []
    if pose["pose_confidence"] < 0.45:
        notes.append("Pose evidence is weak; use only as support for AI tagging.")
    if stance_width < shoulder_width * 0.8:
        notes.append("Stance appears narrow relative to shoulder width.")
    if knee_bend < 0.25:
        notes.append("Limited visible knee bend.")
    if landing_balance < 0.55:
        notes.append("Hip center appears outside base; landing balance may need review.")

    return {
        "stance_width": round(stance_width, 5),
        "knee_bend": round(knee_bend, 5),
        "torso_lean": round(torso_lean, 3),
        "landing_balance": round(landing_balance, 5),
        "release_side_alignment": round(release_side_alignment, 5),
        "notes": notes,
    }


def analyze_frame(mp_pose: Any, cv2: Any, image: Any, timestamp_seconds: float, overlay_context: dict[str, Any] | None) -> dict[str, Any] | None:
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    result = mp_pose.process(rgb)
    if not result.pose_landmarks:
        return None

    pose = collect_landmarks(result.pose_landmarks.landmark)
    return {
        "timestamp_seconds": round(timestamp_seconds, 3),
        **pose,
        "basketball_estimates": estimate_basketball_pose(pose),
        "overlay_context": overlay_context,
    }


def analyze_video(
    cv2: Any,
    mp_pose: Any,
    video_path: Path,
    sample_every_n_frames: int,
    overlay_context: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise ValueError(f"could not open video: {video_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    poses: list[dict[str, Any]] = []
    frame_number = 0

    while True:
        ok, frame = capture.read()
        if not ok:
            break
        if frame_number % sample_every_n_frames == 0:
            timestamp_seconds = frame_number / fps if fps > 0 else 0
            pose = analyze_frame(mp_pose, cv2, frame, timestamp_seconds, overlay_context)
            if pose:
                pose["frame_number"] = frame_number
                poses.append(pose)
        frame_number += 1

    capture.release()
    return poses, {"fps": fps, "width": width, "height": height, "frame_count": frame_count}


def analyze_frames_dir(
    cv2: Any,
    mp_pose: Any,
    frames_dir: Path,
    overlay_context: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not frames_dir.exists():
        raise FileNotFoundError(f"frames directory not found: {frames_dir}")

    image_paths = sorted(
        path for path in frames_dir.iterdir() if path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )
    poses: list[dict[str, Any]] = []
    width = 0
    height = 0

    for index, image_path in enumerate(image_paths):
        image = cv2.imread(str(image_path))
        if image is None:
            continue
        height, width = image.shape[:2]
        pose = analyze_frame(mp_pose, cv2, image, float(index), overlay_context)
        if pose:
            pose["frame_number"] = index
            pose["image_path"] = str(image_path)
            poses.append(pose)

    return poses, {"fps": None, "width": width, "height": height, "frame_count": len(image_paths)}


def main() -> int:
    args = parse_args()
    output_path = Path(args.output_json_path)

    try:
        overlay_context = load_json(args.overlay_config_path)
    except Exception as exc:  # noqa: BLE001 - worker serializes input errors.
        write_json(output_path, error_payload("OVERLAY_CONTEXT_LOAD_FAILURE", str(exc), None))
        return 2

    if not args.video_path and not args.frames_dir:
        write_json(output_path, error_payload("POSE_INPUT_MISSING", "Provide video-path or frames-dir.", overlay_context))
        return 2

    if args.sample_every_n_frames < 1:
        write_json(output_path, error_payload("INVALID_SAMPLE_RATE", "sample_every_n_frames must be greater than 0.", overlay_context))
        return 2

    try:
        import cv2  # type: ignore
    except ImportError:
        write_json(output_path, error_payload("OPENCV_IMPORT_FAILED", "Install opencv-python-headless.", overlay_context))
        return 2

    try:
        import mediapipe as mp  # type: ignore
    except ImportError:
        write_json(output_path, error_payload("MEDIAPIPE_IMPORT_FAILED", "Install mediapipe.", overlay_context))
        return 2

    try:
        with mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.4,
            min_tracking_confidence=0.4,
        ) as pose_model:
            if args.video_path:
                poses, source = analyze_video(
                    cv2,
                    pose_model,
                    Path(args.video_path),
                    args.sample_every_n_frames,
                    overlay_context,
                )
            else:
                poses, source = analyze_frames_dir(
                    cv2,
                    pose_model,
                    Path(args.frames_dir),
                    overlay_context,
                )
    except Exception as exc:  # noqa: BLE001 - worker serializes analysis errors.
        write_json(output_path, error_payload("POSE_ANALYSIS_FAILED", str(exc), overlay_context))
        return 2

    write_json(
        output_path,
        {
            "ok": True,
            "source": source,
            "pose_count": len(poses),
            "overlay_context": overlay_context,
            "poses": poses,
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
