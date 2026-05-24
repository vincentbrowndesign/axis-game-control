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

  const gradient = context.createRadialGradient(readX, height * 0.52, 0, readX, height * 0.52, width * 0.18)
  gradient.addColorStop(0, `rgba(255,255,255,${0.003 + glow * 0.005})`)
  gradient.addColorStop(0.42, `rgba(255,255,255,${0.001 + glow * 0.003})`)
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  context.save()
  for (const wake of atmosphere.wake) {
    const age = atmosphere.clockMs - wake.bornAt
    const life = Math.max(0, 1 - age / 5200)
    const x = timeToX(wake.timestampMs, durationMs, 0, width) + Math.sin(age / 1200) * 2
    context.strokeStyle = `rgba(255,255,255,${life * wake.pressure * 0.006})`
    context.lineWidth = 0.6
    context.beginPath()
    context.ellipse(x, height * 0.52, 12 + (1 - life) * 34, 3 + (1 - life) * 8, 0, 0, Math.PI * 2)
    context.stroke()
  }
  context.restore()

  if (hoverX !== null) {
    const hoverGradient = context.createRadialGradient(hoverX, height * 0.52, 0, hoverX, height * 0.52, width * 0.12)
    hoverGradient.addColorStop(0, "rgba(255,255,255,0.009)")
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

function drawReplayFoundation(context: CanvasRenderingContext2D, readMs: number, durationMs: number, left: number, railWidth: number, baseline: number) {
  const readX = timeToX(readMs, durationMs, left, railWidth)

  context.save()
  context.lineCap = "round"
  context.strokeStyle = "rgba(255,255,255,0.16)"
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(left, baseline)
  context.lineTo(left + railWidth, baseline)
  context.stroke()

  context.strokeStyle = "rgba(255,255,255,0.44)"
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(left, baseline)
  context.lineTo(readX, baseline)
  context.stroke()

  context.strokeStyle = "rgba(255,255,255,0.09)"
  context.lineWidth = 6
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
      context.strokeStyle = `rgba(255,255,255,${0.06 + windowValue.weight * 0.09})`
      context.lineCap = "round"
      context.lineWidth = 4 + windowValue.weight * 1.5
      context.beginPath()
      context.moveTo(x, centerY)
      context.lineTo(end, centerY)
      context.stroke()
    }
  }
  context.restore()
}

function drawPressureRidges(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, baseline: number, height: number) {
  context.save()
  context.strokeStyle = "rgba(255,255,255,0.032)"
  context.lineWidth = 0.55
  for (const frame of frames) {
    const pressure = frame.smoothedPressure
    if (pressure < 0.16) continue
    const x = timeToX(frame.timestamp_ms, durationMs, left, railWidth)
    const ridge = pressure * height * 0.08
    context.beginPath()
    context.moveTo(x, baseline + ridge)
    context.lineTo(x, baseline - ridge)
    context.stroke()
  }
  context.restore()
}

function drawControlTrace(context: CanvasRenderingContext2D, frames: TelemetrySample[], durationMs: number, left: number, railWidth: number, baseline: number, height: number) {
  context.save()
  context.strokeStyle = "rgba(225,225,225,0.13)"
  context.lineWidth = 0.6
  context.beginPath()
  frames.forEach((frame, index) => {
    const x = timeToX(frame.timestamp_ms, durationMs, left, railWidth)
    const y = baseline + (0.5 - frame.smoothedControl) * height * 0.075
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
      const centerY = baseline
      const density = 2 + Math.round(frame.smoothedDensity * 3) + Math.round(hover)
      const clusterWidth = 7 + frame.smoothedPressure * 9 + hover * 5

      context.strokeStyle = `rgba(245,245,245,${0.18 + frame.smoothedPressure * 0.18 + hover * 0.12})`
      context.lineCap = "round"
      context.lineWidth = 3 + frame.smoothedDensity * 1.25 + hover
      context.beginPath()
      context.moveTo(x - clusterWidth * 0.5, centerY)
      context.lineTo(x + clusterWidth * 0.5, centerY)
      context.stroke()

      for (let index = 0; index < density; index += 1) {
        const offset = (index - (density - 1) / 2) * 2.1
        const pulse = 1 - Math.abs(offset) / Math.max(1, clusterWidth * 0.5)
        context.fillStyle = `rgba(245,245,245,${0.13 + pulse * 0.12 + hover * 0.08})`
        context.beginPath()
        context.arc(x + offset, centerY, 0.65 + pulse * 0.45, 0, Math.PI * 2)
        context.fill()
      }
    }
  }
  context.restore()
}

function drawHoverField(context: CanvasRenderingContext2D, hoverMs: number | null, durationMs: number, left: number, railWidth: number, height: number) {
  if (hoverMs === null) return
  const x = timeToX(hoverMs, durationMs, left, railWidth)
  const gradient = context.createLinearGradient(x - 42, 0, x + 42, 0)
  gradient.addColorStop(0, "rgba(255,255,255,0)")
  gradient.addColorStop(0.5, "rgba(255,255,255,0.028)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  context.fillStyle = gradient
  context.fillRect(x - 42, height * 0.36, 84, height * 0.32)
}

function drawReadHead(context: CanvasRenderingContext2D, readMs: number, durationMs: number, left: number, railWidth: number, height: number, persistence: number) {
  const x = timeToX(readMs, durationMs, left, railWidth)
  context.save()
  context.strokeStyle = `rgba(255,255,255,${0.68 + persistence * 0.08})`
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(x, height * 0.2)
  context.lineTo(x, height * 0.82)
  context.stroke()
  context.restore()
}

function drawAtmosphericGrain(context: CanvasRenderingContext2D, width: number, height: number, now: number, density: number) {
  context.save()
  context.fillStyle = `rgba(255,255,255,${0.003 + density * 0.003})`
  for (let index = 0; index < 18; index += 1) {
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
