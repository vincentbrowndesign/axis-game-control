import type { AtmosphericState } from "@/lib/axis-replay/atmosphere"
import { telemetryDuration, type TelemetrySample } from "@/lib/axis-replay/telemetry"

export type RailRenderInput = {
  atmosphere: AtmosphericState
  durationMs: number
  frames: TelemetrySample[]
  height: number
  hoverMs: number | null
  readMs: number
  width: number
}

export function renderTopologyRail(context: CanvasRenderingContext2D, input: RailRenderInput) {
  const { atmosphere, durationMs, frames, height, hoverMs, readMs, width } = input
  context.clearRect(0, 0, width, height)
  context.fillStyle = "#020202"
  context.fillRect(0, 0, width, height)

  const baseline = height * 0.52
  const left = Math.max(18, width * 0.035)
  const right = width - left
  const railWidth = right - left

  drawMemoryWindows(context, frames, durationMs, left, railWidth, height)
  drawPressureRidges(context, frames, durationMs, left, railWidth, baseline, height)
  drawControlTrace(context, frames, durationMs, left, railWidth, baseline, height)
  drawKnots(context, frames, durationMs, left, railWidth, baseline, hoverMs)
  drawHoverField(context, hoverMs, durationMs, left, railWidth, height)
  drawReadHead(context, readMs, durationMs, left, railWidth, height, atmosphere.persistence)
}

export function renderAtmosphereLayer(context: CanvasRenderingContext2D, input: RailRenderInput) {
  const { atmosphere, durationMs, height, hoverMs, readMs, width } = input
  context.clearRect(0, 0, width, height)

  const readX = timeToX(readMs, durationMs, 0, width)
  const hoverX = hoverMs === null ? null : timeToX(hoverMs, durationMs, 0, width)
  const glow = Math.max(atmosphere.persistence, atmosphere.pressure)

  const gradient = context.createRadialGradient(readX, height * 0.52, 0, readX, height * 0.52, width * 0.24)
  gradient.addColorStop(0, `rgba(255,255,255,${0.035 + glow * 0.04})`)
  gradient.addColorStop(0.34, `rgba(255,255,255,${0.012 + glow * 0.018})`)
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  context.save()
  context.globalCompositeOperation = "screen"
  for (const wake of atmosphere.wake) {
    const age = atmosphere.clockMs - wake.bornAt
    const life = Math.max(0, 1 - age / 5200)
    const x = timeToX(wake.timestampMs, durationMs, 0, width) + Math.sin(age / 900) * 4
    context.strokeStyle = `rgba(255,255,255,${life * wake.pressure * 0.052})`
    context.lineWidth = 1
    context.beginPath()
    context.ellipse(x, height * 0.52, 18 + (1 - life) * 72, 8 + (1 - life) * 24, 0, 0, Math.PI * 2)
    context.stroke()
  }
  context.restore()

  if (hoverX !== null) {
    const hoverGradient = context.createRadialGradient(hoverX, height * 0.52, 0, hoverX, height * 0.52, width * 0.18)
    hoverGradient.addColorStop(0, "rgba(255,255,255,0.055)")
    hoverGradient.addColorStop(1, "rgba(255,255,255,0)")
    context.fillStyle = hoverGradient
    context.fillRect(0, 0, width, height)
  }

  drawAtmosphericGrain(context, width, height, atmosphere.clockMs, atmosphere.density)
}

export function nearestKnot(frames: TelemetrySample[], durationMs: number, x: number, width: number) {
  const timestamp = (x / Math.max(1, width)) * durationMs
  let nearest: { distance: number; timestampMs: number } | null = null

  for (const frame of frames) {
    for (const knot of frame.topology.knots) {
      const distance = Math.abs(knot - timestamp)
      if (!nearest || distance < nearest.distance) nearest = { distance, timestampMs: knot }
    }
  }

  if (!nearest || nearest.distance > durationMs * 0.035) return null
  return nearest.timestampMs
}

export function timeFromRailX(x: number, width: number, durationMs: number) {
  return Math.max(0, Math.min(durationMs, (x / Math.max(1, width)) * durationMs))
}

function drawMemoryWindows(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, height: number) {
  for (const frame of frames) {
    for (const windowValue of frame.topology.windows) {
      const x = timeToX(windowValue.start_ms, durationMs, left, railWidth)
      const end = timeToX(windowValue.end_ms, durationMs, left, railWidth)
      context.fillStyle = `rgba(255,255,255,${0.018 + windowValue.weight * 0.03})`
      context.fillRect(x, height * 0.18, Math.max(1, end - x), height * 0.66)
    }
  }
}

function drawPressureRidges(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, baseline: number, height: number) {
  context.save()
  context.strokeStyle = "rgba(255,255,255,0.075)"
  context.lineWidth = 1
  for (const frame of frames) {
    const pressure = frame.smoothedPressure
    if (pressure < 0.08) continue
    const x = timeToX(frame.timestamp_ms, durationMs, left, railWidth)
    const ridge = pressure * height * 0.32
    context.beginPath()
    context.moveTo(x, baseline + ridge * 0.18)
    context.quadraticCurveTo(x + 4, baseline - ridge, x + 10, baseline + ridge * 0.16)
    context.stroke()
  }
  context.restore()
}

function drawControlTrace(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, baseline: number, height: number) {
  context.save()
  context.strokeStyle = "rgba(225,225,225,0.48)"
  context.lineWidth = 1
  context.beginPath()
  frames.forEach((frame, index) => {
    const x = timeToX(frame.timestamp_ms, durationMs, left, railWidth)
    const y = baseline + (0.5 - frame.smoothedControl) * height * 0.38
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()
  context.restore()
}

function drawKnots(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, baseline: number, hoverMs: number | null) {
  context.save()
  for (const frame of frames) {
    for (const knot of frame.topology.knots) {
      const x = timeToX(knot, durationMs, left, railWidth)
      const hover = hoverMs === null ? 0 : Math.max(0, 1 - Math.abs(knot - hoverMs) / 2600)
      const radius = 1.8 + frame.smoothedDensity * 3.2 + hover * 3.8
      context.fillStyle = `rgba(245,245,245,${0.18 + frame.smoothedPressure * 0.32 + hover * 0.22})`
      context.beginPath()
      context.arc(x, baseline + Math.sin(knot * 0.0007) * 12, radius, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = `rgba(255,255,255,${0.08 + hover * 0.18})`
      context.lineWidth = 1
      context.beginPath()
      context.arc(x, baseline + Math.sin(knot * 0.0007) * 12, radius * (2.2 + frame.smoothedPressure), 0, Math.PI * 2)
      context.stroke()
    }
  }
  context.restore()
}

function drawHoverField(context: CanvasRenderingContext2D, hoverMs: number | null, durationMs: number, left: number, railWidth: number, height: number) {
  if (hoverMs === null) return
  const x = timeToX(hoverMs, durationMs, left, railWidth)
  const gradient = context.createLinearGradient(x - 70, 0, x + 70, 0)
  gradient.addColorStop(0, "rgba(255,255,255,0)")
  gradient.addColorStop(0.5, "rgba(255,255,255,0.045)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  context.fillStyle = gradient
  context.fillRect(x - 70, 0, 140, height)
}

function drawReadHead(context: CanvasRenderingContext2D, readMs: number, durationMs: number, left: number, railWidth: number, height: number, persistence: number) {
  const x = timeToX(readMs, durationMs, left, railWidth)
  context.save()
  context.strokeStyle = `rgba(255,255,255,${0.68 + persistence * 0.18})`
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(x, height * 0.14)
  context.lineTo(x, height * 0.88)
  context.stroke()
  context.restore()
}

function drawAtmosphericGrain(context: CanvasRenderingContext2D, width: number, height: number, now: number, density: number) {
  context.save()
  context.fillStyle = `rgba(255,255,255,${0.012 + density * 0.01})`
  for (let index = 0; index < 42; index += 1) {
    const phase = index * 97.13 + now * 0.012
    const x = (Math.sin(phase * 0.017) * 0.5 + 0.5) * width
    const y = (Math.cos(phase * 0.011) * 0.5 + 0.5) * height
    context.fillRect(x, y, 1, 1)
  }
  context.restore()
}

function timeToX(timestampMs: number, durationMs: number, left: number, railWidth: number) {
  return left + (timestampMs / Math.max(1, durationMs || telemetryDuration([]))) * railWidth
}
