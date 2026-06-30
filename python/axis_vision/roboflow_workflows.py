"""Run Axis Roboflow workflows against one sampled image.

Examples:
    python python/axis_vision/roboflow_workflows.py \
      --model yolo_world \
      --image ./test-frame.jpg \
      --output ./roboflow-yolo-result.json

    python python/axis_vision/roboflow_workflows.py \
      --model qwen_vl \
      --image ./test-frame.jpg \
      --output ./roboflow-qwen-result.json \
      --prompt "Check full body visibility and camera framing."

    python python/axis_vision/roboflow_workflows.py \
      --model sam2 \
      --image ./test-frame.jpg \
      --output ./roboflow-sam2-result.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from inference_sdk import InferenceHTTPClient


REPO_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_YOLO_CLASSES = [
    "person",
    "basketball",
    "shoes",
    "feet",
    "hands",
    "rim",
    "cone",
    "chair",
    "tripod",
    "phone",
]

DEFAULT_QWEN_PROMPT = (
    "Look at this frame. Check if the full body is visible, whether feet are visible, "
    "whether the camera is too close, whether lighting is usable, and what the coach "
    "should adjust. Keep it short and practical."
)

WORKFLOW_ENV_BY_MODEL = {
    "sam2": "ROBOFLOW_SAM2_WORKFLOW_ID",
    "yolo_world": "ROBOFLOW_YOLO_WORLD_WORKFLOW_ID",
    "qwen_vl": "ROBOFLOW_QWEN_VL_WORKFLOW_ID",
}


class AxisRoboflowError(RuntimeError):
    """Clean error raised for expected Axis Roboflow runner failures."""


def load_axis_env() -> None:
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / ".env.local", override=True)


def parse_classes(raw_classes: str | None) -> list[str]:
    if not raw_classes:
        return DEFAULT_YOLO_CLASSES

    return [item.strip() for item in raw_classes.split(",") if item.strip()]


def parameters_for_model(model: str, prompt: str | None, classes: str | None) -> dict[str, Any]:
    if model == "sam2":
        return {}

    if model == "yolo_world":
        return {"classes": parse_classes(classes)}

    if model == "qwen_vl":
        return {
            "prompt": prompt or DEFAULT_QWEN_PROMPT,
            "model_version": "Qwen 2.5 VL 72B",
        }

    raise AxisRoboflowError("Unsupported model")


def workflow_id_for_model(model: str) -> str:
    env_name = WORKFLOW_ENV_BY_MODEL.get(model)
    if not env_name:
        raise AxisRoboflowError("Unsupported model")

    workflow_id = os.getenv(env_name)
    if not workflow_id:
        raise AxisRoboflowError("Missing workflow ID")

    return workflow_id


def run_workflow(model: str, image_path: Path, prompt: str | None, classes: str | None) -> dict[str, Any]:
    if not image_path.exists() or not image_path.is_file():
        raise AxisRoboflowError("Image file missing")

    api_key = os.getenv("ROBOFLOW_API_KEY")
    workspace = os.getenv("ROBOFLOW_WORKSPACE")

    if not api_key:
        raise AxisRoboflowError("Missing Roboflow API key")

    if not workspace:
        raise AxisRoboflowError("Missing Roboflow workspace")

    workflow_id = workflow_id_for_model(model)
    parameters = parameters_for_model(model, prompt, classes)
    client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=api_key,
    )

    result = client.run_workflow(
        workspace_name=workspace,
        workflow_id=workflow_id,
        images={
            "image": str(image_path),
        },
        parameters=parameters,
        use_cache=True,
    )

    if result is None:
        raise AxisRoboflowError("Roboflow returned no result")

    return {
        "ok": True,
        "model": model,
        "workspace": workspace,
        "workflowId": workflow_id,
        "parameters": parameters,
        "result": result,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Axis Roboflow workflow checks.")
    parser.add_argument("--model", choices=["sam2", "yolo_world", "qwen_vl"], required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--prompt")
    parser.add_argument("--classes")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    load_axis_env()

    try:
      payload = run_workflow(
          model=args.model,
          image_path=Path(args.image).expanduser().resolve(),
          prompt=args.prompt,
          classes=args.classes,
      )
      write_json(Path(args.output).expanduser().resolve(), payload)
      return 0
    except ModuleNotFoundError:
      error_payload = {"ok": False, "error": "Python dependency missing"}
    except AxisRoboflowError as error:
      error_payload = {"ok": False, "error": str(error)}
    except Exception as error:  # noqa: BLE001 - CLI should serialize unexpected workflow failures.
      error_payload = {"ok": False, "error": "Workflow call failed", "detail": str(error)}

    write_json(Path(args.output).expanduser().resolve(), error_payload)
    print(error_payload["error"], file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
