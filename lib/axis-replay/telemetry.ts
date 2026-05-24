export type AxisTelemetryFrame = {
  frame_id: string | number
  timestamp_ms: number
  control: number
  pressure: number
  spacing: number
  topology: {
    knots: number[]
    windows: Array<{ start_ms: number; end_ms: number; weight: number }>
    temporal_density: number
  }
}

export type TelemetrySample = AxisTelemetryFrame & {
  smoothedControl: number
  smoothedPressure: number
  smoothedSpacing: number
  smoothedDensity: number
}

type RawTelemetryFrame = Partial<{
  frame_id: string | number
  timestamp_ms: number
  timestamp: number
  control: number
  pressure: number
  spacing: number
  topology: Partial<{
    knots: number | number[] | Array<{ at?: number; timestamp_ms?: number }>
    windows: Array<number | { start_ms?: number; end_ms?: number; start?: number; end?: number; weight?: number }>
    temporal_density: number
  }>
}>

type RawKnots = NonNullable<NonNullable<RawTelemetryFrame["topology"]>["knots"]>
type RawWindows = NonNullable<NonNullable<RawTelemetryFrame["topology"]>["windows"]>

export function parseTelemetryStream(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return []

  const raw = trimmed.startsWith("[")
    ? (JSON.parse(trimmed) as RawTelemetryFrame[])
    : trimmed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as RawTelemetryFrame)

  return smoothTelemetry(raw.map(normalizeTelemetryFrame).filter(Boolean) as AxisTelemetryFrame[])
}

export function smoothTelemetry(frames: AxisTelemetryFrame[], alpha = 0.18): TelemetrySample[] {
  const sorted = [...frames].sort((first, second) => first.timestamp_ms - second.timestamp_ms)
  let control = sorted[0]?.control ?? 0
  let pressure = sorted[0]?.pressure ?? 0
  let spacing = sorted[0]?.spacing ?? 0
  let density = sorted[0]?.topology.temporal_density ?? 0

  return sorted.map((frame) => {
    control = ema(control, frame.control, alpha)
    pressure = ema(pressure, frame.pressure, alpha)
    spacing = ema(spacing, frame.spacing, alpha)
    density = ema(density, frame.topology.temporal_density, alpha)

    return {
      ...frame,
      smoothedControl: control,
      smoothedPressure: pressure,
      smoothedSpacing: spacing,
      smoothedDensity: density,
    }
  })
}

export function createFallbackTelemetry(durationMs = 62000) {
  const frames: AxisTelemetryFrame[] = []
  const step = 240

  for (let timestamp = 0; timestamp <= durationMs; timestamp += step) {
    const t = timestamp / durationMs
    const pulseA = Math.max(0, Math.sin(t * Math.PI * 7 - 0.8))
    const pulseB = Math.max(0, Math.sin(t * Math.PI * 11 + 1.4))
    const control = clamp01(0.46 + Math.sin(t * Math.PI * 4.5) * 0.18 - pulseB * 0.12)
    const pressure = clamp01(0.18 + pulseA * 0.54 + pulseB * 0.22)
    const spacing = clamp01(0.62 - pressure * 0.32 + Math.sin(t * Math.PI * 3.2 + 0.4) * 0.12)
    const density = clamp01(0.2 + pressure * 0.5 + Math.max(0, Math.sin(t * Math.PI * 17)) * 0.18)
    const knots = pressure > 0.54 || density > 0.58 ? [timestamp] : []
    const windows = knots.map((knot) => ({
      start_ms: Math.max(0, knot - 1800 - pressure * 900),
      end_ms: Math.min(durationMs, knot + 2300 + density * 1000),
      weight: clamp01(pressure * 0.72 + density * 0.28),
    }))

    frames.push({
      frame_id: `memory-${Math.round(timestamp / step)}`,
      timestamp_ms: timestamp,
      control,
      pressure,
      spacing,
      topology: {
        knots,
        windows,
        temporal_density: density,
      },
    })
  }

  return smoothTelemetry(frames)
}

export function telemetryDuration(frames: TelemetrySample[]) {
  return Math.max(1, frames.at(-1)?.timestamp_ms ?? 1)
}

export function sampleAt(frames: TelemetrySample[], timestampMs: number) {
  if (frames.length === 0) return null
  if (timestampMs <= frames[0].timestamp_ms) return frames[0]
  if (timestampMs >= frames[frames.length - 1].timestamp_ms) return frames[frames.length - 1]

  let low = 0
  let high = frames.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (frames[mid].timestamp_ms < timestampMs) low = mid + 1
    else high = mid - 1
  }

  const next = frames[low]
  const previous = frames[Math.max(0, low - 1)]
  const span = Math.max(1, next.timestamp_ms - previous.timestamp_ms)
  const mix = clamp01((timestampMs - previous.timestamp_ms) / span)

  return {
    ...next,
    timestamp_ms: timestampMs,
    control: lerp(previous.control, next.control, mix),
    pressure: lerp(previous.pressure, next.pressure, mix),
    spacing: lerp(previous.spacing, next.spacing, mix),
    smoothedControl: lerp(previous.smoothedControl, next.smoothedControl, mix),
    smoothedPressure: lerp(previous.smoothedPressure, next.smoothedPressure, mix),
    smoothedSpacing: lerp(previous.smoothedSpacing, next.smoothedSpacing, mix),
    smoothedDensity: lerp(previous.smoothedDensity, next.smoothedDensity, mix),
    topology: {
      ...next.topology,
      temporal_density: lerp(previous.topology.temporal_density, next.topology.temporal_density, mix),
    },
  }
}

function normalizeTelemetryFrame(raw: RawTelemetryFrame, index: number): AxisTelemetryFrame | null {
  const timestamp = number(raw.timestamp_ms ?? raw.timestamp ?? index * 240)
  if (!Number.isFinite(timestamp)) return null

  return {
    frame_id: raw.frame_id ?? index,
    timestamp_ms: Math.max(0, timestamp),
    control: clamp01(number(raw.control, 0.5)),
    pressure: clamp01(number(raw.pressure, 0)),
    spacing: clamp01(number(raw.spacing, 0.5)),
    topology: {
      knots: normalizeKnots(raw.topology?.knots, timestamp),
      windows: normalizeWindows(raw.topology?.windows, timestamp),
      temporal_density: clamp01(number(raw.topology?.temporal_density, 0)),
    },
  }
}

function normalizeKnots(knots: RawKnots | undefined, timestamp: number) {
  if (Array.isArray(knots)) {
    return knots
      .map((knot) => (typeof knot === "number" ? knot : number(knot.at ?? knot.timestamp_ms, timestamp)))
      .filter(Number.isFinite)
      .map((knot) => Math.max(0, knot))
  }
  if (typeof knots === "number" && knots > 0) return [timestamp]
  return []
}

function normalizeWindows(windows: RawWindows | undefined, timestamp: number) {
  if (!Array.isArray(windows)) return []

  return windows
    .map((windowValue) => {
      if (typeof windowValue === "number") {
        return { start_ms: Math.max(0, timestamp - windowValue), end_ms: timestamp + windowValue, weight: 0.5 }
      }

      const start = number(windowValue.start_ms ?? windowValue.start, timestamp - 1600)
      const end = number(windowValue.end_ms ?? windowValue.end, timestamp + 2200)
      return {
        start_ms: Math.max(0, Math.min(start, end)),
        end_ms: Math.max(start, end),
        weight: clamp01(number(windowValue.weight, 0.56)),
      }
    })
    .filter((windowValue) => windowValue.end_ms > windowValue.start_ms)
}

function ema(previous: number, next: number, alpha: number) {
  return previous + (next - previous) * alpha
}

function lerp(start: number, end: number, mix: number) {
  return start + (end - start) * mix
}

function number(value: unknown, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
