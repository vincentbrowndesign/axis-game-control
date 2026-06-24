# Axis and Axis Measure Domain Split

Status: active deployment boundary

## Domains

```text
axis-game-control -> NEXT_PUBLIC_AXIS_SURFACE=auto
ontheaxis.com -> auto resolves to axis
axismeasure.com -> auto resolves to measure
```

`NEXT_PUBLIC_AXIS_SURFACE=auto` lets one Vercel project serve both domains from the request host.

Explicit overrides are still supported:

```text
NEXT_PUBLIC_AXIS_SURFACE=axis
NEXT_PUBLIC_AXIS_SURFACE=measure
```

If `NEXT_PUBLIC_AXIS_SURFACE` is missing, the repo behaves like `auto`. Unknown hosts resolve to `axis` so the public Axis product does not accidentally show Axis Measure branding.

## Product Roles

Axis is the user-facing basketball product and control layer.

Axis should feel like:

```text
Start Session -> capture -> correction -> saved memory -> next session card
```

Axis Measure is the background computer vision and measurement service layer.

Axis Measure should feel like:

```text
player detection -> rim manual lock -> ball detection -> clean measurement output
```

## Route Behavior

| Route | Axis surface | Axis Measure surface |
|---|---|---|
| `/` | Axis user-facing home | Axis Measure service/lab home |
| `/vision` | Axis Vision camera feature | Axis Measure object lock lab |
| `/calibrate` | Axis Vision rim setup surface | Axis Measure rim calibration |
| `/api/vision/detect` | Detector proxy used in the background | Detector proxy used by the lab |

The existing `/axis` session memory product remains the main Axis flow.

The existing `/axis/vision` route remains available and is not removed.

## Integration Boundary

Axis Vision can consume Axis Measure outputs.

Axis Measure may provide detections, object locks, and calibration signals.

Axis decides what becomes useful session memory, correction evidence, or next-session planning.

Do not expose raw detector machinery on the main `/axis` capture screen.
