"""
Axis Tracking V1 — Local verification runner

Opens system webcam (index 0), runs the full tracking pipeline,
and prints PERSON_TRACK_UPDATED events to stdout.

Usage:
    # From repo root, after installing requirements:
    pip install -r tracking/requirements.txt
    python -m tracking.run

    # Optional: pass a video file instead of webcam
    python -m tracking.run --video path/to/clip.mp4

    # Optional: change confidence threshold
    python -m tracking.run --threshold 0.4
"""

from __future__ import annotations

import argparse
import sys

import cv2

from tracking.worker import AxisTrackingWorker


def main() -> None:
    parser = argparse.ArgumentParser(description="Axis Tracking V1 local test")
    parser.add_argument("--video", type=str, default=None, help="Video file path (omit for webcam)")
    parser.add_argument("--session", type=str, default="local-test-001", help="Session ID")
    parser.add_argument("--threshold", type=float, default=0.5, help="Detection confidence threshold")
    parser.add_argument("--max-frames", type=int, default=0, help="Stop after N frames (0 = unlimited)")
    args = parser.parse_args()

    worker = AxisTrackingWorker(
        session_id=args.session,
        detection_threshold=args.threshold,
    )

    source = args.video if args.video else 0
    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f"[ERROR] Could not open source: {source}", file=sys.stderr)
        sys.exit(1)

    print(f"[AXIS TRACKING V1] session={args.session} source={source} threshold={args.threshold}")
    print("[press Ctrl+C to stop]\n")

    frame_count = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            events = worker.process_frame(frame)

            for event in events:
                print(event.to_json(), flush=True)

            frame_count += 1
            if args.max_frames > 0 and frame_count >= args.max_frames:
                break

    except KeyboardInterrupt:
        print(f"\n[STOPPED] {frame_count} frames processed.")
    finally:
        cap.release()


if __name__ == "__main__":
    main()
