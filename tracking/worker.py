"""
Axis Tracking Worker — RF-DETR Nano + Supervision + ByteTrack

Position in the stack:
    Camera frame → RF-DETR Nano → Supervision → ByteTrack → AxisTrackEvent

CV Adapter boundary:
    Owns:  bbox, confidence, track_id, timestamp, frame_index
    Emits: PERSON_TRACK_UPDATED events

Does NOT own:
    Athlete identity, session roster, calibration, history.
    Those belong to Axis Session.

Track IDs are session-scoped visual continuity only.
They reset when the worker is instantiated.
They are not persisted. They are not athlete identity.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from typing import Iterator

import cv2
import numpy as np
import supervision as sv
from PIL import Image
from rfdetr import RFDETRBase

# COCO class index for "person"
_PERSON_CLASS_ID = 0


@dataclass
class _Bbox:
    x1: int
    y1: int
    x2: int
    y2: int


@dataclass
class _Point:
    x: int
    y: int


@dataclass
class AxisPersonTrackPayload:
    sessionId: str
    frameIndex: int
    timestampMs: int
    trackId: int
    className: str
    confidence: float
    bbox: _Bbox
    center: _Point
    foot: _Point


@dataclass
class AxisTrackEvent:
    type: str
    payload: AxisPersonTrackPayload

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "payload": {
                "sessionId": self.payload.sessionId,
                "frameIndex": self.payload.frameIndex,
                "timestampMs": self.payload.timestampMs,
                "trackId": self.payload.trackId,
                "className": self.payload.className,
                "confidence": self.payload.confidence,
                "bbox": asdict(self.payload.bbox),
                "center": asdict(self.payload.center),
                "foot": asdict(self.payload.foot),
            },
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())


class AxisTrackingWorker:
    """
    Stateful per-session worker.

    One worker per recording session.
    Instantiate fresh for each new session to reset track IDs.

    Pipeline per frame:
        np.ndarray (BGR)
        → PIL Image
        → RF-DETR Nano detection (sv.Detections)
        → person-class filter
        → sv.ByteTracker (assigns session-scoped track_id)
        → list[AxisTrackEvent]
    """

    def __init__(
        self,
        session_id: str,
        detection_threshold: float = 0.5,
        frame_rate: int = 30,
    ):
        self.session_id = session_id
        self.detection_threshold = detection_threshold
        self.frame_index = 0

        # RF-DETR Nano — person + object detection
        # RFDETRBase loads the nano-scale weights by default.
        # To use a heavier checkpoint, pass pretrain_weights explicitly.
        self.model = RFDETRBase()

        # ByteTrack — visual continuity across frames, session-scoped only
        self.tracker = sv.ByteTracker(
            track_activation_threshold=0.25,
            lost_track_buffer=30,
            minimum_matching_threshold=0.8,
            frame_rate=frame_rate,
        )

    def process_frame(self, frame: np.ndarray) -> list[AxisTrackEvent]:
        """
        Process one BGR frame. Returns zero or more PERSON_TRACK_UPDATED events.

        Args:
            frame: OpenCV BGR numpy array.

        Returns:
            List of AxisTrackEvent. Empty if no persons detected.
        """
        timestamp_ms = int(time.time() * 1000)

        # RF-DETR expects PIL Image in RGB
        pil_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        detections: sv.Detections = self.model.predict(
            pil_image, threshold=self.detection_threshold
        )

        # Filter to persons only
        if detections.class_id is not None and len(detections) > 0:
            person_mask = detections.class_id == _PERSON_CLASS_ID
            detections = detections[person_mask]

        # ByteTrack: assign session-scoped track IDs
        detections = self.tracker.update_with_detections(detections)

        events: list[AxisTrackEvent] = []

        if detections.tracker_id is None or len(detections) == 0:
            self.frame_index += 1
            return events

        for i in range(len(detections)):
            x1, y1, x2, y2 = detections.xyxy[i].astype(int).tolist()
            track_id = int(detections.tracker_id[i])
            confidence = round(float(detections.confidence[i]), 4)

            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            # Foot = bottom-center of bounding box
            fx = cx
            fy = int(y2)

            payload = AxisPersonTrackPayload(
                sessionId=self.session_id,
                frameIndex=self.frame_index,
                timestampMs=timestamp_ms,
                trackId=track_id,
                className="person",
                confidence=confidence,
                bbox=_Bbox(x1=x1, y1=y1, x2=x2, y2=y2),
                center=_Point(x=cx, y=cy),
                foot=_Point(x=fx, y=fy),
            )

            events.append(
                AxisTrackEvent(type="PERSON_TRACK_UPDATED", payload=payload)
            )

        self.frame_index += 1
        return events

    def process_video(self, video_path: str) -> Iterator[list[AxisTrackEvent]]:
        """
        Offline mode: process a recorded video file.
        Yields one event list per frame.

        Useful for post-session processing or CI testing against fixture video.
        """
        cap = cv2.VideoCapture(video_path)
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                yield self.process_frame(frame)
        finally:
            cap.release()
