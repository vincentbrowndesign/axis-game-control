# Axis CV Foundation v0

Status: Active foundation
Build Decision: Build Now

## Locked Sentence

Axis CV turns video into suggested observations, not truth.

## Purpose

Axis CV Foundation v0 is an isolated visual reality processing foundation. It may process local/server-safe basketball video into suggested observations and debug artifacts.

It is not a product surface, evidence layer, witness layer, memory layer, replay product, overlay product, upload workflow, or dashboard.

## Allowed Outputs

- detections
- tracks
- frame summaries
- event candidates
- debug JSON
- debug MP4

## Not Allowed

- evidence verdicts
- witness verdicts
- verified claims
- player memory
- cross-thread recall
- dashboard
- replay product
- overlay product
- automatic scouting reports
- automatic game truth
- upload product workflow
- camera product workflow
- active `/axis` conversation contract changes

## First Build Target

`tools/cv/axis_cv_local.py`

The first build should run locally against one basketball clip and produce debug outputs without changing product runtime behavior.

## Acceptance Test

One local basketball clip produces:

- `axis-cv-detections.json`
- `axis-cv-summary.json`
- `axis-cv-debug.mp4`

The outputs are suggested observations and debug artifacts only.

## Boundary

CV Foundation may create candidate machine observations. It must not promote those observations to evidence, memory, player facts, replay UI, overlay UI, reports, or persistent product state.

Replay, overlay, evidence, witness, memory, dashboards, upload product workflows, camera product workflows, and player models remain locked until separate explicit build decisions promote them.
