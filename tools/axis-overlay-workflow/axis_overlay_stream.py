import argparse
import os
from pathlib import Path

import cv2
import numpy as np
from inference import InferencePipeline


def parse_args():
    parser = argparse.ArgumentParser(description="Run Axis overlay workflow on webcam or video.")
    parser.add_argument("--source", required=True, help="Webcam index, RTSP URL, or video path.")
    parser.add_argument("--output", help="Optional MP4 path for annotated output.")
    parser.add_argument("--display", action="store_true", default=True, help="Display annotated stream.")
    return parser.parse_args()


def coerce_source(value):
    return int(value) if value.isdigit() else value


def extract_annotated_frame(result, fallback_frame):
    if isinstance(result, list) and result:
        result = result[0]
    if isinstance(result, dict):
        for key in ("annotated_image", "visualization", "image"):
            candidate = result.get(key)
            if isinstance(candidate, np.ndarray):
                return candidate
            if isinstance(candidate, dict) and "image" in candidate and isinstance(candidate["image"], np.ndarray):
                return candidate["image"]
    if hasattr(fallback_frame, "image") and isinstance(fallback_frame.image, np.ndarray):
        return fallback_frame.image
    if isinstance(fallback_frame, np.ndarray):
        return fallback_frame
    return None


def main():
    args = parse_args()
    api_key = os.environ.get("ROBOFLOW_API_KEY")
    workspace = os.environ.get("ROBOFLOW_WORKSPACE")
    workflow_id = os.environ.get("ROBOFLOW_WORKFLOW_ID")
    api_url = os.environ.get("ROBOFLOW_API_URL")

    missing = [name for name, value in {
        "ROBOFLOW_API_KEY": api_key,
        "ROBOFLOW_WORKSPACE": workspace,
        "ROBOFLOW_WORKFLOW_ID": workflow_id,
    }.items() if not value]
    if missing:
        raise RuntimeError(f"Missing environment variables: {', '.join(missing)}")

    writer = None
    output_path = Path(args.output) if args.output else None

    def sink(result, video_frame):
        nonlocal writer
        frame = extract_annotated_frame(result, video_frame)
        if frame is None:
            return

        height, width = frame.shape[:2]
        if output_path and writer is None:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            writer = cv2.VideoWriter(
                str(output_path),
                cv2.VideoWriter_fourcc(*"mp4v"),
                30,
                (width, height),
            )
        if writer:
            writer.write(frame)
        if args.display:
            cv2.imshow("Axis Overlay Workflow", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                raise KeyboardInterrupt

    pipeline_kwargs = {
        "api_key": api_key,
        "workspace_name": workspace,
        "workflow_id": workflow_id,
        "video_reference": coerce_source(args.source),
        "on_prediction": sink,
    }
    if api_url:
        pipeline_kwargs["api_url"] = api_url

    pipeline = InferencePipeline.init_with_workflow(**pipeline_kwargs)
    try:
        pipeline.start()
        pipeline.join()
    finally:
        if writer:
            writer.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
