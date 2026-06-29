#!/usr/bin/env python3
"""Generate a short Axis Basketball clip from a reviewed AI event window."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a clip around a reviewed AI event.")
    parser.add_argument("--source-video-path", required=True, help="Local source video path.")
    parser.add_argument("--event-start-time-seconds", required=True, type=float)
    parser.add_argument("--event-end-time-seconds", required=True, type=float)
    parser.add_argument("--output-clip-path", required=True, help="Output clip path.")
    return parser.parse_args()


def write_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2))


def get_duration_ffprobe(source_video_path: Path) -> float | None:
    if not shutil.which("ffprobe"):
        return None

    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(source_video_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None

    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def get_duration_opencv(source_video_path: Path) -> float | None:
    try:
      import cv2  # type: ignore
    except ImportError:
      return None

    capture = cv2.VideoCapture(str(source_video_path))
    if not capture.isOpened():
        return None

    fps = capture.get(cv2.CAP_PROP_FPS) or 0
    frame_count = capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    capture.release()

    if fps <= 0:
        return None

    return float(frame_count / fps)


def generate_with_ffmpeg(
    source_video_path: Path,
    output_clip_path: Path,
    start_time: float,
    duration: float,
) -> bool:
    if not shutil.which("ffmpeg"):
        return False

    output_clip_path.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start_time:.3f}",
            "-i",
            str(source_video_path),
            "-t",
            f"{duration:.3f}",
            "-c",
            "copy",
            str(output_clip_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and output_clip_path.exists()


def generate_with_opencv(
    source_video_path: Path,
    output_clip_path: Path,
    start_time: float,
    end_time: float,
) -> bool:
    try:
      import cv2  # type: ignore
    except ImportError:
      return False

    capture = cv2.VideoCapture(str(source_video_path))
    if not capture.isOpened():
        return False

    fps = capture.get(cv2.CAP_PROP_FPS) or 0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if fps <= 0 or width <= 0 or height <= 0:
        capture.release()
        return False

    output_clip_path.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_clip_path), fourcc, fps, (width, height))
    if not writer.isOpened():
        capture.release()
        return False

    start_frame = int(start_time * fps)
    end_frame = int(end_time * fps)
    capture.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    frame_index = start_frame
    while frame_index <= end_frame:
        ok, frame = capture.read()
        if not ok:
            break
        writer.write(frame)
        frame_index += 1

    writer.release()
    capture.release()
    return output_clip_path.exists()


def main() -> int:
    args = parse_args()
    source_video_path = Path(args.source_video_path)
    output_clip_path = Path(args.output_clip_path)

    if not source_video_path.exists():
        write_json(
            {
                "status": "error",
                "error": "SOURCE_VIDEO_MISSING",
                "output_path": str(output_clip_path),
            }
        )
        return 2

    video_duration = get_duration_ffprobe(source_video_path) or get_duration_opencv(source_video_path)
    if video_duration is None:
        write_json(
            {
                "status": "error",
                "error": "VIDEO_DURATION_UNAVAILABLE",
                "output_path": str(output_clip_path),
            }
        )
        return 2

    start_time = max(0.0, args.event_start_time_seconds - 2.0)
    end_time = min(video_duration, args.event_end_time_seconds + 3.0)
    duration = max(0.0, end_time - start_time)

    if duration <= 0:
        write_json(
            {
                "status": "error",
                "error": "CLIP_WINDOW_INVALID",
                "output_path": str(output_clip_path),
                "start_time": start_time,
                "end_time": end_time,
                "duration": duration,
            }
        )
        return 2

    generated = generate_with_ffmpeg(source_video_path, output_clip_path, start_time, duration)
    method = "ffmpeg"

    if not generated:
        generated = generate_with_opencv(source_video_path, output_clip_path, start_time, end_time)
        method = "opencv"

    if not generated:
        write_json(
            {
                "status": "error",
                "error": "CLIP_GENERATION_FAILED",
                "output_path": str(output_clip_path),
                "start_time": round(start_time, 3),
                "end_time": round(end_time, 3),
                "duration": round(duration, 3),
            }
        )
        return 2

    write_json(
        {
            "status": "created",
            "output_path": str(output_clip_path),
            "duration": round(duration, 3),
            "start_time": round(start_time, 3),
            "end_time": round(end_time, 3),
            "method": method,
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
