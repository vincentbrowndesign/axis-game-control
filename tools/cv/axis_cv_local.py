#!/usr/bin/env python3
"""Axis CV Local Runner v0.

Turns one local video into suggested visual observations, not truth.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


BOUNDARY = "suggested_observations_only"
BOUNDARY_NOTE = (
    "Axis CV turns video into suggested observations, not truth. "
    "These outputs are not evidence, verified stats, player memory, replay UI, or automatic game truth."
)


@dataclass
class TrackState:
    id: int
    centroid: tuple[float, float]
    frames: list[int] = field(default_factory=list)
    boxes: list[list[int]] = field(default_factory=list)
    missed: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Process a local sports clip into Axis CV suggested observations.",
    )
    parser.add_argument("--input", required=True, help="Path to a local video file.")
    parser.add_argument(
        "--output-dir",
        default=".tmp-axis-cv",
        help="Directory for axis-cv-detections.json, axis-cv-summary.json, and axis-cv-debug.mp4.",
    )
    parser.add_argument(
        "--sample-every",
        type=int,
        default=3,
        help="Analyze every Nth frame. Higher values are faster but less detailed.",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="Optional cap on processed frames. 0 processes the whole clip.",
    )
    parser.add_argument(
        "--min-area-ratio",
        type=float,
        default=0.0015,
        help="Minimum moving-object contour area as a ratio of frame area.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()

    if args.sample_every < 1:
        raise SystemExit("--sample-every must be 1 or greater.")
    if args.max_frames < 0:
        raise SystemExit("--max-frames cannot be negative.")
    if not input_path.exists():
        raise SystemExit(f"Input video not found: {input_path}")

    try:
        import cv2  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "OpenCV is required. Install dependencies with: "
            "python -m pip install -r tools/cv/requirements.txt"
        ) from exc

    output_dir.mkdir(parents=True, exist_ok=True)
    result = process_video(
        cv2=cv2,
        input_path=input_path,
        output_dir=output_dir,
        sample_every=args.sample_every,
        max_frames=args.max_frames,
        min_area_ratio=args.min_area_ratio,
    )

    write_json(output_dir / "axis-cv-detections.json", result["detections"])
    write_json(output_dir / "axis-cv-summary.json", result["summary"])

    print(f"Wrote {output_dir / 'axis-cv-detections.json'}")
    print(f"Wrote {output_dir / 'axis-cv-summary.json'}")
    print(f"Wrote {output_dir / 'axis-cv-debug.mp4'}")
    return 0


def process_video(
    *,
    cv2: Any,
    input_path: Path,
    output_dir: Path,
    sample_every: int,
    max_frames: int,
    min_area_ratio: float,
) -> dict[str, Any]:
    capture = cv2.VideoCapture(str(input_path))
    if not capture.isOpened():
        raise SystemExit(f"Could not open input video: {input_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if width <= 0 or height <= 0:
        capture.release()
        raise SystemExit("Input video has invalid dimensions.")

    debug_path = output_dir / "axis-cv-debug.mp4"
    writer = cv2.VideoWriter(
        str(debug_path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )
    if not writer.isOpened():
        capture.release()
        raise SystemExit(f"Could not create debug MP4: {debug_path}")

    subtractor = cv2.createBackgroundSubtractorMOG2(
        history=max(120, int(fps * 4)),
        varThreshold=32,
        detectShadows=True,
    )

    frame_area = width * height
    min_area = max(80, int(frame_area * min_area_ratio))
    tracks: list[TrackState] = []
    detections: list[dict[str, Any]] = []
    frame_summaries: list[dict[str, Any]] = []
    event_candidates: list[dict[str, Any]] = []
    next_track_id = 1
    processed_frames = 0
    frame_index = 0

    while True:
        ok, frame = capture.read()
        if not ok:
            break
        if max_frames and frame_index >= max_frames:
            break

        should_analyze = frame_index % sample_every == 0
        frame_detections: list[dict[str, Any]] = []
        motion_area = 0

        if should_analyze:
            frame_detections, motion_area = detect_motion_objects(
                cv2=cv2,
                frame=frame,
                subtractor=subtractor,
                min_area=min_area,
            )
            next_track_id = update_tracks(
                tracks=tracks,
                detections=frame_detections,
                frame_index=frame_index,
                next_track_id=next_track_id,
            )
            annotate_frame(
                cv2=cv2,
                frame=frame,
                detections=frame_detections,
                frame_index=frame_index,
                time_seconds=frame_index / fps,
            )

            detections.append(
                {
                    "frame": frame_index,
                    "time_seconds": round(frame_index / fps, 3),
                    "boundary": BOUNDARY,
                    "objects": frame_detections,
                }
            )
            frame_summaries.append(
                {
                    "frame": frame_index,
                    "time_seconds": round(frame_index / fps, 3),
                    "moving_object_count": len(frame_detections),
                    "motion_area_ratio": round(motion_area / frame_area, 5),
                    "suggested_observation": summarize_frame(frame_detections, motion_area, frame_area),
                }
            )
            processed_frames += 1

        writer.write(frame)
        frame_index += 1

    capture.release()
    writer.release()

    track_records = summarize_tracks(tracks, fps)
    event_candidates = infer_event_candidates(frame_summaries)

    detection_doc = {
        "schema": "axis-cv-detections-v0",
        "boundary": BOUNDARY,
        "boundary_note": BOUNDARY_NOTE,
        "input": {
            "path": str(input_path),
            "width": width,
            "height": height,
            "fps": round(fps, 3),
            "reported_total_frames": total_frames,
            "processed_frames": processed_frames,
            "sample_every": sample_every,
        },
        "detections": detections,
        "tracks": track_records,
        "frame_summaries": frame_summaries,
        "event_candidates": event_candidates,
    }

    summary_doc = {
        "schema": "axis-cv-summary-v0",
        "boundary": BOUNDARY,
        "boundary_note": BOUNDARY_NOTE,
        "input": {
            "path": str(input_path),
            "duration_seconds_estimate": round((total_frames / fps), 3) if fps and total_frames else None,
            "processed_frames": processed_frames,
        },
        "summary": {
            "suggested_detection_count": sum(len(frame["objects"]) for frame in detections),
            "suggested_track_count": len(track_records),
            "event_candidate_count": len(event_candidates),
            "highest_motion_frames": top_motion_frames(frame_summaries),
        },
        "event_candidates": event_candidates,
        "debug_artifacts": {
            "detections_json": "axis-cv-detections.json",
            "summary_json": "axis-cv-summary.json",
            "debug_mp4": "axis-cv-debug.mp4",
        },
        "not_allowed": [
            "evidence verdicts",
            "verified stats",
            "player memory",
            "cross-thread recall",
            "replay product",
            "overlay product",
            "automatic scouting reports",
        ],
    }

    return {"detections": detection_doc, "summary": summary_doc}


def detect_motion_objects(*, cv2: Any, frame: Any, subtractor: Any, min_area: int) -> tuple[list[dict[str, Any]], int]:
    mask = subtractor.apply(frame)
    mask = cv2.medianBlur(mask, 5)
    _, mask = cv2.threshold(mask, 220, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.dilate(mask, kernel, iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    objects: list[dict[str, Any]] = []
    motion_area = 0

    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < min_area:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        if w <= 2 or h <= 2:
            continue
        motion_area += int(area)
        objects.append(
            {
                "kind": "moving_region",
                "confidence": "motion_candidate",
                "bbox": [int(x), int(y), int(w), int(h)],
                "centroid": [round(x + w / 2, 2), round(y + h / 2, 2)],
                "area": int(area),
                "boundary": BOUNDARY,
            }
        )

    objects.sort(key=lambda item: item["area"], reverse=True)
    return objects[:16], motion_area


def update_tracks(
    *,
    tracks: list[TrackState],
    detections: list[dict[str, Any]],
    frame_index: int,
    next_track_id: int,
) -> int:
    unmatched_tracks = set(range(len(tracks)))
    max_distance = 90.0

    for detection in detections:
        centroid = tuple(detection["centroid"])
        best_track_index = None
        best_distance = max_distance

        for track_index in list(unmatched_tracks):
            distance = euclidean(centroid, tracks[track_index].centroid)
            if distance < best_distance:
                best_distance = distance
                best_track_index = track_index

        if best_track_index is None:
            detection["track_id"] = next_track_id
            tracks.append(
                TrackState(
                    id=next_track_id,
                    centroid=(float(centroid[0]), float(centroid[1])),
                    frames=[frame_index],
                    boxes=[detection["bbox"]],
                )
            )
            next_track_id += 1
            continue

        track = tracks[best_track_index]
        track.centroid = (float(centroid[0]), float(centroid[1]))
        track.frames.append(frame_index)
        track.boxes.append(detection["bbox"])
        track.missed = 0
        detection["track_id"] = track.id
        unmatched_tracks.discard(best_track_index)

    for track_index in unmatched_tracks:
        tracks[track_index].missed += 1

    tracks[:] = [track for track in tracks if track.missed <= 12 or len(track.frames) >= 3]
    return next_track_id


def annotate_frame(*, cv2: Any, frame: Any, detections: list[dict[str, Any]], frame_index: int, time_seconds: float) -> None:
    for detection in detections:
        x, y, w, h = detection["bbox"]
        track_id = detection.get("track_id", "?")
        cv2.rectangle(frame, (x, y), (x + w, y + h), (44, 180, 120), 2)
        cv2.putText(
            frame,
            f"suggested track {track_id}",
            (x, max(18, y - 7)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (44, 180, 120),
            1,
            cv2.LINE_AA,
        )

    cv2.putText(
        frame,
        f"Axis CV suggested observations | frame {frame_index} | {time_seconds:.2f}s",
        (18, 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.58,
        (245, 245, 245),
        2,
        cv2.LINE_AA,
    )


def summarize_frame(detections: list[dict[str, Any]], motion_area: int, frame_area: int) -> str:
    count = len(detections)
    motion_ratio = motion_area / frame_area if frame_area else 0
    if count == 0:
        return "No large moving region detected in this sampled frame."
    if count >= 6 or motion_ratio > 0.08:
        return "Possible crowded action or transition moment; needs human review."
    if count >= 3:
        return "Multiple moving regions suggest active play shape; needs human review."
    return "One or two moving regions suggest isolated movement; needs human review."


def summarize_tracks(tracks: list[TrackState], fps: float) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for track in tracks:
        if len(track.frames) < 2:
            continue
        first = track.frames[0]
        last = track.frames[-1]
        records.append(
            {
                "track_id": track.id,
                "boundary": BOUNDARY,
                "first_frame": first,
                "last_frame": last,
                "duration_seconds_estimate": round((last - first) / fps, 3) if fps else None,
                "sample_count": len(track.frames),
                "last_bbox": track.boxes[-1],
                "suggested_observation": "Motion track candidate. Not a player identity or verified possession.",
            }
        )
    return records


def infer_event_candidates(frame_summaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for frame in frame_summaries:
        if frame["moving_object_count"] >= 5 or frame["motion_area_ratio"] >= 0.08:
            events.append(
                {
                    "kind": "high_motion_sequence_candidate",
                    "boundary": BOUNDARY,
                    "frame": frame["frame"],
                    "time_seconds": frame["time_seconds"],
                    "reason": "Motion density crossed the local threshold.",
                    "needs_human_review": True,
                }
            )
    return events[:24]


def top_motion_frames(frame_summaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked = sorted(frame_summaries, key=lambda item: item["motion_area_ratio"], reverse=True)
    return [
        {
            "frame": item["frame"],
            "time_seconds": item["time_seconds"],
            "motion_area_ratio": item["motion_area_ratio"],
            "moving_object_count": item["moving_object_count"],
        }
        for item in ranked[:8]
    ]


def euclidean(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
