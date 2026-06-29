#!/usr/bin/env python3
"""Create Axis Basketball AI event candidates from detections and overlay context.

This worker does not create final truth. It creates cautious possible_* event
candidates for later AI reasoning and coach review.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


PLAYER_CLASSES = {"person", "player"}
BALL_CLASSES = {"sports ball", "ball"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert detections plus overlay context into basketball event candidates."
    )
    parser.add_argument("--detection-json", required=True, help="Detection JSON from detect_video.py.")
    parser.add_argument("--overlay-config-json", required=True, help="Overlay config/context JSON.")
    parser.add_argument("--output-json-path", required=True, help="Candidate output JSON path.")
    parser.add_argument("--pose-json", default=None, help="Optional pose JSON path.")
    parser.add_argument("--session-metadata-json", default=None, help="Optional session metadata JSON path.")
    return parser.parse_args()


def load_json(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None

    json_path = Path(path)
    if not json_path.exists():
        raise FileNotFoundError(f"JSON file not found: {json_path}")

    with json_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def bbox_center(bbox_xyxy: list[float]) -> tuple[float, float]:
    x1, y1, x2, y2 = bbox_xyxy
    return ((x1 + x2) / 2, (y1 + y2) / 2)


def normalize_point(x: float, y: float, width: float, height: float) -> dict[str, float]:
    return {
        "x": round(x / width, 4) if width else 0,
        "y": round(y / height, 4) if height else 0,
    }


def point_in_zone(point: dict[str, float], zone: dict[str, Any]) -> bool:
    x = point["x"]
    y = point["y"]

    if {"x1", "y1", "x2", "y2"}.issubset(zone):
        return zone["x1"] <= x <= zone["x2"] and zone["y1"] <= y <= zone["y2"]

    if {"x", "y", "radius"}.issubset(zone):
        dx = x - zone["x"]
        dy = y - zone["y"]
        return (dx * dx + dy * dy) ** 0.5 <= zone["radius"]

    return False


def default_zone_map() -> list[dict[str, Any]]:
    return [
        {"name": "paint", "x1": 0.36, "y1": 0.05, "x2": 0.64, "y2": 0.34},
        {"name": "left_corner", "x1": 0.0, "y1": 0.74, "x2": 0.2, "y2": 1.0},
        {"name": "right_corner", "x1": 0.8, "y1": 0.74, "x2": 1.0, "y2": 1.0},
        {"name": "left_elbow", "x": 0.39, "y": 0.34, "radius": 0.08},
        {"name": "right_elbow", "x": 0.61, "y": 0.34, "radius": 0.08},
        {"name": "top", "x": 0.5, "y": 0.78, "radius": 0.12},
        {"name": "slot", "x1": 0.32, "y1": 0.55, "x2": 0.68, "y2": 0.86},
    ]


def get_zone_map(overlay_config: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("court_zone_map", "zone_map", "zones"):
        zones = overlay_config.get(key)
        if isinstance(zones, list):
            return zones

    calibration = overlay_config.get("calibration") or {}
    zones = calibration.get("court_zone_map") or calibration.get("zones")
    if isinstance(zones, list):
        return zones

    return default_zone_map()


def get_delta_points(overlay_config: dict[str, Any]) -> list[dict[str, Any]]:
    configured = overlay_config.get("delta_points")
    if isinstance(configured, list):
        return configured

    return [
        {"name": "top/get", "x": 0.5, "y": 0.78, "radius": 0.12},
        {"name": "elbow", "x": 0.39, "y": 0.34, "radius": 0.1},
        {"name": "corner DHO", "x": 0.12, "y": 0.84, "radius": 0.12},
    ]


def detection_tracks_by_frame(
    detection_json: dict[str, Any],
) -> tuple[dict[int, list[dict[str, Any]]], dict[str, Any]]:
    video = detection_json.get("video") or {}
    width = float(video.get("width") or 0)
    height = float(video.get("height") or 0)
    by_frame: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for detection in detection_json.get("detections", []):
        bbox = detection.get("bbox_xyxy")
        if not isinstance(bbox, list) or len(bbox) != 4:
            continue

        cx, cy = bbox_center([float(value) for value in bbox])
        enriched = {
            **detection,
            "center": normalize_point(cx, cy, width, height),
        }
        by_frame[int(detection.get("frame_number", 0))].append(enriched)

    return by_frame, video


def zones_for_detection(detection: dict[str, Any], zones: list[dict[str, Any]]) -> list[str]:
    return [zone["name"] for zone in zones if zone.get("name") and point_in_zone(detection["center"], zone)]


def make_candidate(
    event_type: str,
    timestamps: list[float],
    confidence: float,
    reason: str,
    overlay_context: dict[str, Any],
    evidence: dict[str, Any],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    start = min(timestamps) if timestamps else 0
    end = max(timestamps) if timestamps else start
    return {
        "event_type": event_type,
        "start_time_seconds": round(start, 3),
        "end_time_seconds": round(max(end, start + 0.5), 3),
        "confidence": round(max(0.05, min(confidence, 0.88)), 3),
        "reason": reason,
        "overlay_context": overlay_context,
        "evidence": evidence,
        "metadata": metadata,
    }


def create_candidates(
    detection_json: dict[str, Any],
    overlay_config: dict[str, Any],
    pose_json: dict[str, Any] | None,
    session_metadata: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    by_frame, video = detection_tracks_by_frame(detection_json)
    zones = get_zone_map(overlay_config)
    delta_points = get_delta_points(overlay_config)
    overlay_context = {
        "overlay_config": overlay_config,
        "court_zone_map": zones,
    }
    metadata_base = {
        "source": "overlay-event-candidates",
        "recording_id": session_metadata.get("recording_id") if session_metadata else None,
        "pose_available": pose_json is not None,
    }

    zone_hits: dict[str, list[dict[str, Any]]] = defaultdict(list)
    ball_frames: list[dict[str, Any]] = []
    player_frames: list[dict[str, Any]] = []

    for detections in by_frame.values():
        for detection in detections:
            class_name = str(detection.get("class_name", "")).lower()
            hit_zones = zones_for_detection(detection, zones)

            if class_name in PLAYER_CLASSES:
                player_frames.append(detection)
            if class_name in BALL_CLASSES:
                ball_frames.append(detection)

            if class_name in PLAYER_CLASSES or class_name in BALL_CLASSES:
                for zone_name in hit_zones:
                    zone_hits[zone_name].append(detection)

    candidates: list[dict[str, Any]] = []

    for zone_name, event_type in [
        ("paint", "possible_paint_touch"),
        ("left_corner", "possible_corner_touch"),
        ("right_corner", "possible_corner_touch"),
        ("left_elbow", "possible_elbow_touch"),
        ("right_elbow", "possible_elbow_touch"),
    ]:
        hits = zone_hits.get(zone_name, [])
        if not hits:
            continue

        timestamps = [float(hit.get("timestamp_seconds", 0)) for hit in hits]
        confidence = 0.42 + min(len(hits), 5) * 0.06
        candidates.append(
            make_candidate(
                event_type,
                timestamps,
                confidence,
                f"Player or ball detection appears inside the calibrated {zone_name} overlay zone.",
                overlay_context,
                {
                    "zone": zone_name,
                    "frames": [hit.get("frame_number") for hit in hits[:8]],
                    "detections": hits[:8],
                },
                metadata_base,
            )
        )

    if ball_frames:
        timestamps = [float(hit.get("timestamp_seconds", 0)) for hit in ball_frames]
        confidence = 0.36 + min(len(ball_frames), 6) * 0.04
        candidates.append(
            make_candidate(
                "possible_shot",
                timestamps,
                confidence,
                "Sports ball detections are present; this may include a shot or pass sequence.",
                overlay_context,
                {
                    "frames": [hit.get("frame_number") for hit in ball_frames[:8]],
                    "detections": ball_frames[:8],
                },
                metadata_base,
            )
        )

    corner_hits = zone_hits.get("left_corner", []) + zone_hits.get("right_corner", [])
    paint_hits = zone_hits.get("paint", [])
    elbow_hits = zone_hits.get("left_elbow", []) + zone_hits.get("right_elbow", [])

    if corner_hits and (paint_hits or elbow_hits):
        first_corner = min(float(hit.get("timestamp_seconds", 0)) for hit in corner_hits)
        later_middle_hits = [
            hit
            for hit in paint_hits + elbow_hits
            if float(hit.get("timestamp_seconds", 0)) >= first_corner
        ]
        if later_middle_hits:
            candidates.append(
                make_candidate(
                    "possible_drive",
                    [first_corner]
                    + [float(hit.get("timestamp_seconds", 0)) for hit in later_middle_hits],
                    0.54,
                    "Activity starts in a calibrated corner zone and later appears near elbow or paint.",
                    overlay_context,
                    {
                        "start_zone": "corner",
                        "end_zones": ["elbow", "paint"],
                        "frames": [hit.get("frame_number") for hit in (corner_hits + later_middle_hits)[:10]],
                    },
                    metadata_base,
                )
            )

    if len(ball_frames) >= 2 and (zone_hits.get("slot") or corner_hits):
        candidates.append(
            make_candidate(
                "possible_kickout",
                [float(hit.get("timestamp_seconds", 0)) for hit in ball_frames],
                0.38,
                "Ball detections overlap with perimeter overlay zones; this may be a kickout or perimeter pass.",
                overlay_context,
                {
                    "zones": ["slot", "corner"],
                    "frames": [hit.get("frame_number") for hit in ball_frames[:8]],
                },
                metadata_base,
            )
        )

    if len(ball_frames) >= 3:
        candidates.append(
            make_candidate(
                "possible_extra_pass",
                [float(hit.get("timestamp_seconds", 0)) for hit in ball_frames],
                0.32,
                "Multiple ball detections across sampled frames may indicate continued ball movement.",
                overlay_context,
                {
                    "frames": [hit.get("frame_number") for hit in ball_frames[:10]],
                },
                metadata_base,
            )
        )

    player_count_by_frame = [len([d for d in detections if str(d.get("class_name", "")).lower() in PLAYER_CLASSES]) for detections in by_frame.values()]
    if player_count_by_frame and max(player_count_by_frame) >= 3:
        candidates.append(
            make_candidate(
                "possible_spacing_issue",
                [float(d.get("timestamp_seconds", 0)) for d in player_frames[:10]],
                0.28,
                "Several player detections appear in sampled frames; spacing should be reviewed against the overlay.",
                overlay_context,
                {
                    "max_players_in_frame": max(player_count_by_frame),
                    "frames": [hit.get("frame_number") for hit in player_frames[:10]],
                },
                metadata_base,
            )
        )

    delta_hits: list[dict[str, Any]] = []
    for detections in by_frame.values():
        for detection in detections:
            if str(detection.get("class_name", "")).lower() not in PLAYER_CLASSES | BALL_CLASSES:
                continue
            for point in delta_points:
                if point.get("name") and point_in_zone(detection["center"], point):
                    delta_hits.append({**detection, "delta_label": point["name"]})

    if delta_hits:
        candidates.append(
            make_candidate(
                "possible_delta_action",
                [float(hit.get("timestamp_seconds", 0)) for hit in delta_hits],
                0.46,
                "Activity overlaps a Delta Offense overlay label such as top/get, elbow, or corner DHO.",
                overlay_context,
                {
                    "delta_labels": sorted({hit["delta_label"] for hit in delta_hits}),
                    "frames": [hit.get("frame_number") for hit in delta_hits[:10]],
                    "detections": delta_hits[:8],
                },
                metadata_base,
            )
        )

    if player_frames or ball_frames:
        all_activity = player_frames + ball_frames
        candidates.append(
            make_candidate(
                "possible_clip_moment",
                [float(hit.get("timestamp_seconds", 0)) for hit in all_activity],
                0.3,
                "Detected player or ball activity creates a possible clip review moment.",
                overlay_context,
                {
                    "frames": [hit.get("frame_number") for hit in all_activity[:10]],
                },
                metadata_base,
            )
        )

    return candidates


def main() -> int:
    args = parse_args()
    output_path = Path(args.output_json_path)

    try:
        detection_json = load_json(args.detection_json) or {}
        overlay_config = load_json(args.overlay_config_json) or {}
        pose_json = load_json(args.pose_json)
        session_metadata = load_json(args.session_metadata_json)
        candidates = create_candidates(detection_json, overlay_config, pose_json, session_metadata)
        write_json(
            output_path,
            {
                "ok": True,
                "candidate_count": len(candidates),
                "candidates": candidates,
            },
        )
        return 0
    except Exception as exc:  # noqa: BLE001 - worker must serialize failures.
        write_json(
            output_path,
            {
                "ok": False,
                "error": {
                    "code": "CANDIDATE_GENERATION_FAILED",
                    "message": str(exc),
                },
                "candidates": [],
            },
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
