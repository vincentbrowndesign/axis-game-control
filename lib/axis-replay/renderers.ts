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

  drawReplayFoundation(context, readMs, durationMs, left, railWidth, baseline)
  drawMemoryWindows(context, frames, durationMs, left, railWidth, height)
  drawPressureMarks(context, frames, durationMs, left, railWidth, baseline, height)
  drawKnots(context, frames, durationMs, left, railWidth, baseline, hoverMs)
  drawReadHead(context, readMs, durationMs, left, railWidth, height, atmosphere.persistence)
}

export function renderAtmosphereLayer(context: CanvasRenderingContext2D, input: RailRenderInput) {
  const { atmosphere, durationMs, height, readMs, width } = input
  context.clearRect(0, 0, width, height)

  const readX = timeToX(readMs, durationMs, 0, width)
  const glow = Math.max(atmosphere.persistence, atmosphere.pressure)
  if (glow < 0.18) return

  const gradient = context.createLinearGradient(readX - 18, 0, readX + 18, 0)
  gradient.addColorStop(0, "rgba(255,255,255,0)")
  gradient.addColorStop(0.5, `rgba(255,255,255,${glow * 0.004})`)
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  context.fillStyle = gradient
  context.fillRect(readX - 18, height * 0.35, 36, height * 0.3)
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

function drawReplayFoundation(context: CanvasRenderingContext2D, readMs: number, durationMs: number, left: number, railWidth: number, baseline: number) {
  const readX = timeToX(readMs, durationMs, left, railWidth)

  context.save()
  context.lineCap = "round"
  context.strokeStyle = "rgba(255,255,255,0.14)"
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(left, baseline)
  context.lineTo(left + railWidth, baseline)
  context.stroke()

  context.strokeStyle = "rgba(255,255,255,0.38)"
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(left, baseline)
  context.lineTo(readX, baseline)
  context.stroke()

  context.strokeStyle = "rgba(255,255,255,0.045)"
  context.lineWidth = 5
  context.beginPath()
  context.moveTo(left, baseline)
  context.lineTo(left + railWidth, baseline)
  context.stroke()
  context.restore()
}

function drawMemoryWindows(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, height: number) {
  context.save()
  for (const frame of frames) {
    for (const windowValue of frame.topology.windows) {
      const x = timeToX(windowValue.start_ms, durationMs, left, railWidth)
      const end = timeToX(windowValue.end_ms, durationMs, left, railWidth)
      const centerY = height * 0.52
      context.strokeStyle = `rgba(255,255,255,${0.035 + windowValue.weight * 0.055})`
      context.lineCap = "round"
      context.lineWidth = 3 + windowValue.weight * 0.75
      context.beginPath()
      context.moveTo(x, centerY)
      context.lineTo(end, centerY)
      context.stroke()
    }
  }
  context.restore()
}

function drawPressureMarks(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, baseline: number, height: number) {
  context.save()
  context.strokeStyle = "rgba(255,255,255,0.026)"
  context.lineWidth = 0.5
  for (const frame of frames) {
    const pressure = frame.smoothedPressure
    if (pressure < 0.32) continue
    const x = timeToX(frame.timestamp_ms, durationMs, left, railWidth)
    const ridge = pressure * height * 0.035
    context.beginPath()
    context.moveTo(x, baseline + ridge)
    context.lineTo(x, baseline - ridge)
    context.stroke()
  }
  context.restore()
}

function drawKnots(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, baseline: number, hoverMs: number | null) {
  context.save()
  for (const frame of frames) {
    for (const knot of frame.topology.knots) {
      const x = timeToX(knot, durationMs, left, railWidth)
      const hover = hoverMs === null ? 0 : Math.max(0, 1 - Math.abs(knot - hoverMs) / 1600) * 0.35
      const centerY = baseline
      const density = 1 + Math.round(frame.smoothedDensity * 2) + Math.round(hover)
      const clusterWidth = 5 + frame.smoothedPressure * 6 + hover * 3

      context.strokeStyle = `rgba(245,245,245,${0.15 + frame.smoothedPressure * 0.12 + hover * 0.06})`
      context.lineCap = "round"
      context.lineWidth = 2.4 + frame.smoothedDensity * 0.75 + hover * 0.5
      context.beginPath()
      context.moveTo(x - clusterWidth * 0.5, centerY)
      context.lineTo(x + clusterWidth * 0.5, centerY)
      context.stroke()

      for (let index = 0; index < density; index += 1) {
        const offset = (index - (density - 1) / 2) * 2.1
        const pulse = 1 - Math.abs(offset) / Math.max(1, clusterWidth * 0.5)
        context.fillStyle = `rgba(245,245,245,${0.1 + pulse * 0.09 + hover * 0.04})`
        context.beginPath()
        context.arc(x + offset, centerY, 0.5 + pulse * 0.32, 0, Math.PI * 2)
        context.fill()
      }
    }
  }
  context.restore()
}

function drawReadHead(context: CanvasRenderingContext2D, readMs: number, durationMs: number, left: number, railWidth: number, height: number, persistence: number) {
  const x = timeToX(readMs, durationMs, left, railWidth)
  context.save()
  context.strokeStyle = `rgba(255,255,255,${0.62 + persistence * 0.04})`
  context.lineWidth = 0.9
  context.beginPath()
  context.moveTo(x, height * 0.2)
  context.lineTo(x, height * 0.82)
  context.stroke()
  context.restore()
}

function timeToX(timestampMs: number, durationMs: number, left: number, railWidth: number) {
  return left + (timestampMs / Math.max(1, durationMs || telemetryDuration([]))) * railWidth
}
