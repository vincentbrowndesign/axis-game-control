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
  drawKnots(context, frames, durationMs, left, railWidth, baseline, hoverMs)
  drawReadHead(context, readMs, durationMs, left, railWidth, height, atmosphere.persistence)
}

export function renderAtmosphereLayer(context: CanvasRenderingContext2D, input: RailRenderInput) {
  const { height, width } = input
  context.clearRect(0, 0, width, height)
}

export function nearestKnot(frames: TelemetrySample[], durationMs: number, x: number, width: number) {
  const { left, railWidth } = railBounds(width)
  const timestamp = timeFromRailX(x, width, durationMs)
  let nearest: { distance: number; timestampMs: number } | null = null

  for (const frame of frames) {
    for (const knot of frame.topology.knots) {
      const distance = Math.abs(knot - timestamp)
      if (!nearest || distance < nearest.distance) nearest = { distance, timestampMs: knot }
    }
  }

  const hitWindowMs = Math.max(1200, durationMs * 0.025)
  const hitWidth = Math.max(12, width * 0.018)
  const nearestX = nearest
    ? timeToX(nearest.timestampMs, durationMs, left, railWidth)
    : 0

  if (
    !nearest ||
    (nearest.distance > hitWindowMs && Math.abs(nearestX - x) > hitWidth)
  ) {
    return null
  }

  return nearest.timestampMs
}

export function timeFromRailX(x: number, width: number, durationMs: number) {
  const { left, railWidth } = railBounds(width)
  return Math.max(0, Math.min(durationMs, ((x - left) / Math.max(1, railWidth)) * durationMs))
}

export function railXFromTime(timestampMs: number, durationMs: number, width: number) {
  const { left, railWidth } = railBounds(width)
  return timeToX(timestampMs, durationMs, left, railWidth)
}

function railBounds(width: number) {
  const left = Math.max(18, width * 0.035)
  return {
    left,
    railWidth: Math.max(1, width - left * 2),
  }
}

function drawReplayFoundation(context: CanvasRenderingContext2D, readMs: number, durationMs: number, left: number, railWidth: number, baseline: number) {
  const readX = timeToX(readMs, durationMs, left, railWidth)

  context.save()
  context.lineCap = "round"
  context.strokeStyle = "rgba(255,255,255,0.12)"
  context.lineWidth = 1.6
  context.beginPath()
  context.moveTo(left, baseline)
  context.lineTo(left + railWidth, baseline)
  context.stroke()

  context.strokeStyle = "rgba(255,255,255,0.32)"
  context.lineWidth = 1.6
  context.beginPath()
  context.moveTo(left, baseline)
  context.lineTo(readX, baseline)
  context.stroke()

  context.strokeStyle = "rgba(255,255,255,0.03)"
  context.lineWidth = 4
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
      context.strokeStyle = `rgba(255,255,255,${0.025 + windowValue.weight * 0.04})`
      context.lineCap = "round"
      context.lineWidth = 2.4 + windowValue.weight * 0.5
      context.beginPath()
      context.moveTo(x, centerY)
      context.lineTo(end, centerY)
      context.stroke()
    }
  }
  context.restore()
}

function drawKnots(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, baseline: number, hoverMs: number | null) {
  context.save()
  for (const frame of frames) {
    for (const knot of frame.topology.knots) {
      const x = timeToX(knot, durationMs, left, railWidth)
      const hover = hoverMs === null ? 0 : Math.max(0, 1 - Math.abs(knot - hoverMs) / 1200) * 0.18
      const centerY = baseline
      const density = 1 + Math.round(frame.smoothedDensity * 1.4) + Math.round(hover)
      const clusterWidth = 4 + frame.smoothedPressure * 4 + hover * 2

      context.strokeStyle = `rgba(245,245,245,${0.12 + frame.smoothedPressure * 0.09 + hover * 0.035})`
      context.lineCap = "round"
      context.lineWidth = 1.8 + frame.smoothedDensity * 0.5 + hover * 0.3
      context.beginPath()
      context.moveTo(x - clusterWidth * 0.5, centerY)
      context.lineTo(x + clusterWidth * 0.5, centerY)
      context.stroke()

      for (let index = 0; index < density; index += 1) {
        const offset = (index - (density - 1) / 2) * 2.1
        const pulse = 1 - Math.abs(offset) / Math.max(1, clusterWidth * 0.5)
        context.fillStyle = `rgba(245,245,245,${0.08 + pulse * 0.065 + hover * 0.025})`
        context.beginPath()
        context.arc(x + offset, centerY, 0.42 + pulse * 0.22, 0, Math.PI * 2)
        context.fill()
      }
    }
  }
  context.restore()
}

function drawReadHead(context: CanvasRenderingContext2D, readMs: number, durationMs: number, left: number, railWidth: number, height: number, persistence: number) {
  const x = timeToX(readMs, durationMs, left, railWidth)
  context.save()
  context.strokeStyle = `rgba(255,255,255,${0.58 + persistence * 0.03})`
  context.lineWidth = 0.85
  context.beginPath()
  context.moveTo(x, height * 0.2)
  context.lineTo(x, height * 0.82)
  context.stroke()
  context.restore()
}

function timeToX(timestampMs: number, durationMs: number, left: number, railWidth: number) {
  return left + (timestampMs / Math.max(1, durationMs || telemetryDuration([]))) * railWidth
}
