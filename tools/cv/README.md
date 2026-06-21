# Axis CV Local Runner v0

Status: CV Foundation local tool.

Axis CV turns video into suggested observations, not truth. This runner does not create evidence, verified stats, player memory, replay UI, overlay UI, or automatic game truth.

## Install

```bash
python -m pip install -r tools/cv/requirements.txt
```

## Run

```bash
python tools/cv/axis_cv_local.py --input sample.mp4 --output-dir .tmp-axis-cv
```

The output directory will contain:

- `axis-cv-detections.json`
- `axis-cv-summary.json`
- `axis-cv-debug.mp4`

## Output Boundary

Allowed outputs:

- detections
- tracks
- frame summaries
- event candidates
- debug JSON
- debug MP4

Not allowed in this tool:

- evidence verdicts
- verified stats
- player memory
- cross-thread recall
- replay product UI
- overlay product UI
- automatic scouting reports
- product runtime behavior

## Notes

The first implementation is deliberately simple: it uses local motion regions and centroid tracking so Axis can inspect visual reality without pretending to know what happened. Human review is still required before any observation becomes evidence or product truth.
