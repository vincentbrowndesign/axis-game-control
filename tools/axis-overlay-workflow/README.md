# Axis Overlay Workflow

Small Roboflow Workflows pipeline for visual overlays only.

Pipeline:

```text
RF-DETR
-> ByteTrack
-> Custom Python Block
-> OpenCV overlay
-> annotated video stream
```

No Trigger.dev. No Supabase. No database.

## Roboflow Workflow

Create a Workflow with:

1. `Object Detection Model`
   - model: RF-DETR, for example `rfdetr-small` or your trained basketball model
   - output: `predictions`
2. `ByteTrack Tracker`
   - image: input image
   - detections: model predictions
   - output: `tracked_detections`
3. `Custom Python Block`
   - image: input image
   - tracked_detections: ByteTrack tracked detections
   - code: `axis_overlay_custom_block.py`
   - output: `annotated_image`

`workflow-definition.json` documents the intended block wiring for local Inference deployments that accept workflow definitions.

## Run Webcam

```bash
pip install -r tools/axis-overlay-workflow/requirements.txt
python tools/axis-overlay-workflow/axis_overlay_stream.py --source 0
```

## Run Uploaded Video

```bash
python tools/axis-overlay-workflow/axis_overlay_stream.py --source path/to/clip.mp4 --output annotated.mp4
```

Required environment variables:

```text
ROBOFLOW_API_KEY
ROBOFLOW_WORKSPACE
ROBOFLOW_WORKFLOW_ID
```

Optional:

```text
ROBOFLOW_API_URL=http://127.0.0.1:9001
```

Use local Roboflow Inference for stable ByteTrack state across frames.
