import type { TelemetrySample } from "@/lib/axis-replay/telemetry"

export type AutoClipReason =
  | "collapse_window"
  | "momentum_shift"
  | "pressure_spike"
  | "replay_window"
  | "shot_attempt"
  | "topology_knot"
  | "transition"
  | "turnover"

export type AutoClipPlan = {
  anchorMs: number
  endMs: number
  fileName: string
  id: string
  label: string
  reason: AutoClipReason
  startMs: number
  weight: number
}

type TimelineClipWindow = {
  anchorMs?: number
  endMs?: number
  reason?: string
  startMs?: number
  weight?: number
}

type TimelineEvent = {
  clipWindow?: TimelineClipWindow
  confidence?: number
  timestampMs?: number
  type?: string
}

export type StructuredTimelineLike = {
  clipWindows?: TimelineClipWindow[]
  events?: TimelineEvent[]
}

type ClipCandidate = {
  anchorMs: number
  endMs: number
  reason: AutoClipReason
  startMs: number
  weight: number
}

const MAX_CLIP_MS = 18000
const MIN_CLIP_MS = 4200

export function buildAutoClipPlan({
  durationMs,
  maxClips = 8,
  sessionId,
  telemetry,
  timeline,
}: {
  durationMs: number
  maxClips?: number
  sessionId: string
  telemetry: TelemetrySample[]
  timeline: StructuredTimelineLike
}): AutoClipPlan[] {
  const candidates = [
    ...clipsFromTimeline(timeline),
    ...clipsFromTelemetry(telemetry),
  ]
    .map((clip) => trimClip(clip, durationMs))
    .filter((clip) => clip.endMs - clip.startMs >= MIN_CLIP_MS * 0.72)
    .sort((first, second) => second.weight - first.weight)

  const selected: ClipCandidate[] = []
  for (const candidate of candidates) {
    const duplicate = selected.some(
      (clip) => Math.abs(clip.anchorMs - candidate.anchorMs) < 2600
    )
    if (duplicate) continue
    selected.push(candidate)
    if (selected.length >= maxClips) break
  }

  return selected
    .sort((first, second) => first.anchorMs - second.anchorMs)
    .map((clip, index) => {
      const reason = clip.reason
      const label = labelForReason(reason)
      const time = timeSlug(clip.anchorMs)

      return {
        ...clip,
        fileName: `${String(index + 1).padStart(2, "0")}-${slug(label)}-${time}.mp4`,
        id: `${sessionId}-clip-${String(index + 1).padStart(2, "0")}`,
        label,
      }
    })
}

function clipsFromTimeline(timeline: StructuredTimelineLike): ClipCandidate[] {
  const windows = (timeline.clipWindows ?? []).map((windowValue) =>
    candidateFromWindow(windowValue, "replay_window")
  )
  const events = (timeline.events ?? [])
    .filter((event) => event.timestampMs != null)
    .flatMap((event) => {
      const reason = normalizeReason(event.type)
      const anchorMs = Number(event.timestampMs ?? 0)
      const windowClip = event.clipWindow
        ? candidateFromWindow(event.clipWindow, reason)
        : null
      const eventClip: ClipCandidate = {
        anchorMs,
        endMs: anchorMs + afterForReason(reason),
        reason,
        startMs: Math.max(0, anchorMs - beforeForReason(reason)),
        weight: clamp01(Number(event.confidence ?? 0.52)),
      }

      return windowClip ? [windowClip, eventClip] : [eventClip]
    })

  return [...windows, ...events].filter(
    (clip): clip is ClipCandidate => Boolean(clip)
  )
}

function clipsFromTelemetry(telemetry: TelemetrySample[]): ClipCandidate[] {
  const clips: ClipCandidate[] = []

  for (let index = 0; index < telemetry.length; index += 1) {
    const frame = telemetry[index]
    const previous = telemetry[Math.max(0, index - 1)]
    const pressureLift = frame.smoothedPressure - previous.smoothedPressure

    for (const knot of frame.topology.knots) {
      clips.push({
        anchorMs: knot,
        endMs: knot + 4200,
        reason: "topology_knot",
        startMs: Math.max(0, knot - 3600),
        weight: clamp01(0.42 + frame.smoothedDensity * 0.34 + frame.smoothedPressure * 0.24),
      })
    }

    for (const windowValue of frame.topology.windows) {
      clips.push({
        anchorMs: (windowValue.start_ms + windowValue.end_ms) / 2,
        endMs: windowValue.end_ms,
        reason: "replay_window",
        startMs: windowValue.start_ms,
        weight: clamp01(windowValue.weight),
      })
    }

    if (frame.smoothedPressure > 0.68 && pressureLift > 0.035) {
      clips.push({
        anchorMs: frame.timestamp_ms,
        endMs: frame.timestamp_ms + 4600,
        reason: "pressure_spike",
        startMs: Math.max(0, frame.timestamp_ms - 4200),
        weight: clamp01(frame.smoothedPressure),
      })
    }
  }

  return clips
}

function candidateFromWindow(
  windowValue: TimelineClipWindow,
  fallbackReason: AutoClipReason
): ClipCandidate | null {
  const startMs = Number(windowValue.startMs)
  const endMs = Number(windowValue.endMs)
  const anchorMs = Number(windowValue.anchorMs ?? (startMs + endMs) / 2)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null

  return {
    anchorMs,
    endMs,
    reason: normalizeReason(windowValue.reason) || fallbackReason,
    startMs,
    weight: clamp01(Number(windowValue.weight ?? 0.48)),
  }
}

function trimClip(clip: ClipCandidate, durationMs: number): ClipCandidate {
  const anchorMs = clamp(clip.anchorMs, 0, Math.max(0, durationMs))
  const desiredStart = Math.min(clip.startMs, anchorMs - 1000)
  const desiredEnd = Math.max(clip.endMs, anchorMs + 1000)
  let startMs = Math.max(0, desiredStart)
  let endMs = durationMs > 0 ? Math.min(durationMs, desiredEnd) : desiredEnd

  if (endMs - startMs > MAX_CLIP_MS) {
    startMs = Math.max(0, anchorMs - beforeForReason(clip.reason))
    endMs = durationMs > 0
      ? Math.min(durationMs, startMs + MAX_CLIP_MS)
      : startMs + MAX_CLIP_MS
  }

  if (endMs - startMs < MIN_CLIP_MS) {
    const missing = MIN_CLIP_MS - (endMs - startMs)
    startMs = Math.max(0, startMs - missing / 2)
    endMs = durationMs > 0 ? Math.min(durationMs, endMs + missing / 2) : endMs + missing / 2
  }

  return {
    ...clip,
    anchorMs,
    endMs,
    startMs,
  }
}

function normalizeReason(value: unknown): AutoClipReason {
  if (value === "collapse_window") return "collapse_window"
  if (value === "momentum_shift") return "momentum_shift"
  if (value === "pressure_spike") return "pressure_spike"
  if (value === "shot_attempt") return "shot_attempt"
  if (value === "topology_knot") return "topology_knot"
  if (value === "transition") return "transition"
  if (value === "turnover") return "turnover"
  return "replay_window"
}

function labelForReason(reason: AutoClipReason) {
  if (reason === "collapse_window") return "Collapse Window"
  if (reason === "momentum_shift") return "Momentum Shift"
  if (reason === "pressure_spike") return "Pressure Spike"
  if (reason === "shot_attempt") return "Shot Attempt"
  if (reason === "topology_knot") return "Replay Knot"
  if (reason === "transition") return "Transition"
  if (reason === "turnover") return "Turnover"
  return "Replay Window"
}

function beforeForReason(reason: AutoClipReason) {
  if (reason === "turnover") return 5200
  if (reason === "momentum_shift") return 6200
  if (reason === "shot_attempt") return 4400
  if (reason === "transition") return 4200
  return 3600
}

function afterForReason(reason: AutoClipReason) {
  if (reason === "collapse_window") return 5600
  if (reason === "momentum_shift") return 5600
  if (reason === "shot_attempt") return 5200
  if (reason === "turnover") return 4600
  return 4200
}

function timeSlug(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}${String(seconds).padStart(2, "0")}`
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function clamp01(value: number) {
  return clamp(value, 0, 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
