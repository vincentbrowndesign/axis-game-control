from collections import defaultdict, deque
import math

import cv2
import numpy as np


BALL_CLASSES = {"ball", "basketball", "sports ball"}
PLAYER_CLASSES = {"person", "player", "athlete"}
BALL_TRAIL = deque(maxlen=24)
PLAYER_LAST = {}
PULSES = deque(maxlen=32)


def run(self, image, tracked_detections):
    frame = _image_to_bgr(image)
    detections = list(_detections_to_records(tracked_detections))
    height, width = frame.shape[:2]

    players = []
    balls = []

    for detection in detections:
        class_name = detection["class_name"].lower().strip()
        if class_name in BALL_CLASSES:
            balls.append(detection)
        elif class_name in PLAYER_CLASSES:
            players.append(detection)

    ball = max(balls, key=lambda item: item["confidence"], default=None)
    if ball:
        BALL_TRAIL.append((ball["cx"], ball["cy"]))
        _maybe_ball_pulse(ball)

    for player in players:
        _draw_player_ring(frame, player)
        _draw_player_label(frame, player)
        _maybe_player_pulse(player)

    _draw_ball_trail(frame, list(BALL_TRAIL))
    if ball:
        _draw_ball_glow(frame, ball)

    _draw_pressure_pulses(frame)

    return {
        "annotated_image": frame,
        "overlay_payload": {
            "width": width,
            "height": height,
            "players": [
                {
                    "id": player["track_id"],
                    "x": player["cx"],
                    "y": player["cy"],
                    "confidence": player["confidence"],
                }
                for player in players
            ],
            "ball": None
            if ball is None
            else {
                "x": ball["cx"],
                "y": ball["cy"],
                "confidence": ball["confidence"],
            },
        },
    }


def _image_to_bgr(image):
    if isinstance(image, np.ndarray):
        frame = image
    elif hasattr(image, "numpy_image"):
        frame = image.numpy_image
    elif hasattr(image, "image"):
        frame = image.image
    elif isinstance(image, dict) and "image" in image:
        frame = image["image"]
    else:
        frame = np.asarray(image)

    if frame.ndim == 2:
        return cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
    if frame.shape[-1] == 4:
        return cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
    return frame.copy()


def _detections_to_records(detections):
    if detections is None:
        return

    if hasattr(detections, "xyxy"):
        xyxy = np.asarray(detections.xyxy)
        confidences = np.asarray(getattr(detections, "confidence", np.ones(len(xyxy))))
        data = getattr(detections, "data", {}) or {}
        class_names = data.get("class_name", ["object"] * len(xyxy))
        tracker_ids = data.get("tracker_id", data.get("track_id", [-1] * len(xyxy)))

        for index, box in enumerate(xyxy):
            yield _record_from_box(
                box,
                class_names[index] if index < len(class_names) else "object",
                float(confidences[index]) if index < len(confidences) else 1.0,
                tracker_ids[index] if index < len(tracker_ids) else -1,
            )
        return

    if isinstance(detections, dict):
        detections = detections.get("predictions", detections.get("detections", []))

    for item in detections or []:
        if isinstance(item, dict):
            yield _record_from_dict(item)


def _record_from_box(box, class_name, confidence, track_id):
    x1, y1, x2, y2 = [float(value) for value in box[:4]]
    return {
        "class_name": str(class_name),
        "confidence": confidence,
        "track_id": str(track_id),
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2,
        "cx": (x1 + x2) / 2,
        "cy": (y1 + y2) / 2,
    }


def _record_from_dict(item):
    class_name = item.get("class") or item.get("class_name") or item.get("label") or "object"
    confidence = float(item.get("confidence", item.get("score", 1.0)))
    track_id = item.get("tracker_id", item.get("track_id", item.get("id", "-1")))

    if all(key in item for key in ("x", "y", "width", "height")):
        cx = float(item["x"])
        cy = float(item["y"])
        half_w = float(item["width"]) / 2
        half_h = float(item["height"]) / 2
        x1, y1, x2, y2 = cx - half_w, cy - half_h, cx + half_w, cy + half_h
    else:
        x1 = float(item.get("x1", item.get("xmin", 0)))
        y1 = float(item.get("y1", item.get("ymin", 0)))
        x2 = float(item.get("x2", item.get("xmax", x1)))
        y2 = float(item.get("y2", item.get("ymax", y1)))
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2

    return {
        "class_name": str(class_name),
        "confidence": confidence,
        "track_id": str(track_id),
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2,
        "cx": cx,
        "cy": cy,
    }


def _draw_player_ring(frame, player):
    center = (int(player["cx"]), int(player["y2"] + 4))
    axes = (max(18, int((player["x2"] - player["x1"]) * 0.42)), 9)
    cv2.ellipse(frame, center, axes, 0, 0, 360, (245, 248, 239), 2, cv2.LINE_AA)
    overlay = frame.copy()
    cv2.ellipse(overlay, center, (max(14, axes[0] - 5), 6), 0, 0, 360, (245, 248, 239), -1, cv2.LINE_AA)
    cv2.addWeighted(overlay, 0.16, frame, 0.84, 0, frame)


def _draw_player_label(frame, player):
    track_id = player["track_id"] if player["track_id"] != "-1" else "P"
    label = f"#{track_id}"
    x = int(player["cx"] - 18)
    y = int(max(16, player["y1"] - 10))
    cv2.putText(frame, label, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (245, 248, 239), 2, cv2.LINE_AA)


def _draw_ball_trail(frame, points):
    if len(points) < 2:
        return
    for index in range(1, len(points)):
        fade = index / max(1, len(points) - 1)
        thickness = int(2 + fade * 6)
        color = (int(78 * fade), 255, int(174 * fade))
        p1 = (int(points[index - 1][0]), int(points[index - 1][1]))
        p2 = (int(points[index][0]), int(points[index][1]))
        cv2.line(frame, p1, p2, color, thickness, cv2.LINE_AA)


def _draw_ball_glow(frame, ball):
    center = (int(ball["cx"]), int(ball["cy"]))
    overlay = frame.copy()
    cv2.circle(overlay, center, 26, (78, 255, 174), -1, cv2.LINE_AA)
    cv2.addWeighted(overlay, 0.18, frame, 0.82, 0, frame)
    cv2.circle(frame, center, 7, (78, 255, 174), -1, cv2.LINE_AA)


def _draw_pressure_pulses(frame):
    if not PULSES:
        return
    next_pulses = deque(maxlen=32)
    for pulse in PULSES:
        pulse["age"] += 1
        age = pulse["age"] / 18
        if age >= 1:
            continue
        radius = int(18 + age * 70 * pulse["strength"])
        alpha = (1 - age) * 0.28
        overlay = frame.copy()
        cv2.ellipse(
            overlay,
            (int(pulse["x"]), int(pulse["y"] + 5)),
            (radius, max(8, int(radius * 0.36))),
            0,
            0,
            360,
            (78, 255, 174),
            2,
            cv2.LINE_AA,
        )
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        next_pulses.append(pulse)
    PULSES.clear()
    PULSES.extend(next_pulses)


def _maybe_ball_pulse(ball):
    if len(BALL_TRAIL) < 2:
        return
    previous = BALL_TRAIL[-2]
    distance = math.hypot(ball["cx"] - previous[0], ball["cy"] - previous[1])
    if distance >= 32:
        PULSES.append({"age": 0, "strength": min(1.3, distance / 90), "x": ball["cx"], "y": ball["cy"]})


def _maybe_player_pulse(player):
    previous = PLAYER_LAST.get(player["track_id"])
    PLAYER_LAST[player["track_id"]] = (player["cx"], player["cy"])
    if previous is None:
        return
    distance = math.hypot(player["cx"] - previous[0], player["cy"] - previous[1])
    if distance >= 42:
        PULSES.append({"age": 0, "strength": min(1.0, distance / 120), "x": player["cx"], "y": player["y2"]})
