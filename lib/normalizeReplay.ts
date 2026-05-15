import type {
  CalibrationBaseline,
} from "@/lib/calibration/types"
import type {
  ExtractedReplaySignals,
  SignalTimelineSegment,
} from "@/lib/signals/types"
import type {
  AxisReplaySession,
  MemoryState,
  MemoryTimelineEvent,
  ReplaySessionView,
  SessionEnvironment,
  SessionSource,
} from "@/types/memory"

const DEFAULT_REPLAY = {
  id: "",
  status: "offline",
  memoryCount: 0,
  archiveStatus: "inactive",
  timelineEvents: [] as MemoryTimelineEvent[],
  ambientLine: "Memory initializing.",
  contextLine: "Building replay context.",
  videoUrl: "",
  createdAt: Date.now(),
}

type NormalizedTimelineItem = NonNullable<ReplaySessionView["timeline"]>[number]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0
    ? value
    : fallback
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) return parsed
  }

  return fallback
}

function asTimestamp(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime()

    if (Number.isFinite(parsed)) return parsed
  }

  return fallback
}

function asSource(value: unknown): SessionSource {
  return value === "camera" ? "camera" : "upload"
}

function asEnvironment(value: unknown): SessionEnvironment {
  if (
    value === "game" ||
    value === "practice" ||
    value === "mission" ||
    value === "workout"
  ) {
    return value
  }

  return "practice"
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.length > 0
  )
}

function asTone(value: unknown): "lime" | "cyan" | "zinc" {
  if (value === "lime" || value === "cyan" || value === "zinc") {
    return value
  }

  return "cyan"
}

function normalizeTimelineEvents(value: unknown): MemoryTimelineEvent[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const record = asRecord(item)
      const label = asString(record.label, "")

      if (!label) return null

      return {
        label,
        time: asString(record.time, "00:00"),
        body: asString(
          record.body ?? record.detail,
          "Session memory available."
        ),
        tone: asTone(record.tone),
      }
    })
    .filter((item): item is MemoryTimelineEvent => Boolean(item))
}

function normalizeTimeline(
  value: unknown,
  events: MemoryTimelineEvent[]
): ReplaySessionView["timeline"] {
  const raw = Array.isArray(value) ? value : events

  return raw
    .map<NormalizedTimelineItem | null>((item) => {
      const record = asRecord(item)
      const label = asString(record.label, "")

      if (!label) return null

      return {
        time: asString(record.time, "00:00"),
        label,
        detail: asString(
          record.detail ?? record.body,
          "Session memory available."
        ),
        tone: asTone(record.tone),
      }
    })
    .filter(
      (item): item is NormalizedTimelineItem => item !== null
    )
}

function normalizeMemoryState(
  value: unknown,
  fallback: {
    memoryCount: number
    archiveStatus: string
    ambientLine: string
    contextLine: string
    timelineEvents: MemoryTimelineEvent[]
  }
): MemoryState | undefined {
  const record = asRecord(value)

  if (!Object.keys(record).length) return undefined

  return {
    headline: asString(record.headline, "Memory Online"),
    status: asString(record.status, "Replay recovering."),
    ambientLine: asString(record.ambientLine, fallback.ambientLine),
    contextLine: asString(record.contextLine, fallback.contextLine),
    archiveStatus: asString(record.archiveStatus, fallback.archiveStatus),
    memoryCount: asNumber(record.memoryCount, fallback.memoryCount),
    timelineEvents: normalizeTimelineEvents(
      record.timelineEvents ?? fallback.timelineEvents
    ),
    confidence: Math.max(0, Math.min(100, asNumber(record.confidence, 0))),
  }
}

function asActivityState(value: unknown) {
  return value === "low" || value === "active" || value === "unknown"
    ? value
    : "unknown"
}

function asAudioState(value: unknown) {
  return value === "silent" || value === "noisy" || value === "unknown"
    ? value
    : "unknown"
}

function asSignalSegmentLabel(
  value: unknown
): SignalTimelineSegment["label"] {
  if (
    value === "LOW ACTIVITY" ||
    value === "ACTIVE MOTION" ||
    value === "BRIGHTNESS SHIFT" ||
    value === "AUDIO ENERGY"
  ) {
    return value
  }

  return "LOW ACTIVITY"
}

function normalizeSignalTimeline(value: unknown): SignalTimelineSegment[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const record = asRecord(item)

      return {
        start: asNumber(record.start, 0),
        end: asNumber(record.end, asNumber(record.start, 0)),
        label: asSignalSegmentLabel(record.label),
        evidence: asString(record.evidence, "Signal recorded."),
      }
    })
    .filter((item) => item.end >= item.start)
}

function normalizeSignalRead(
  value: unknown
): ExtractedReplaySignals | undefined {
  const record = asRecord(value)

  if (!Object.keys(record).length) return undefined

  return {
    duration: asNumber(record.duration, 0),
    frameSampleCount: Math.max(0, asNumber(record.frameSampleCount, 0)),
    averageBrightness:
      record.averageBrightness == null
        ? null
        : asNumber(record.averageBrightness, 0),
    brightnessShifts: Math.max(0, asNumber(record.brightnessShifts, 0)),
    motionIntensity:
      record.motionIntensity == null
        ? null
        : asNumber(record.motionIntensity, 0),
    cameraMovement:
      record.cameraMovement == null
        ? null
        : asNumber(record.cameraMovement, 0),
    activityState: asActivityState(record.activityState),
    audioEnergy:
      record.audioEnergy == null ? null : asNumber(record.audioEnergy, 0),
    audioState: asAudioState(record.audioState),
    timeline: normalizeSignalTimeline(record.timeline),
  }
}

function asBaselineStatus(value: unknown): CalibrationBaseline["status"] {
  if (
    value === "BASELINE STARTED" ||
    value === "MEMORY ADDED" ||
    value === "NOT ENOUGH MEMORY" ||
    value === "COMPARISON LOCKED"
  ) {
    return value
  }

  return "BASELINE STARTED"
}

function normalizeBaseline(
  value: unknown
): CalibrationBaseline | undefined {
  const record = asRecord(value)

  if (!Object.keys(record).length) return undefined

  return {
    status: asBaselineStatus(record.status),
    averageSessionDuration: asNumber(record.averageSessionDuration, 0),
    averageMotionIntensity:
      record.averageMotionIntensity == null
        ? null
        : asNumber(record.averageMotionIntensity, 0),
    averageAudioEnergy:
      record.averageAudioEnergy == null
        ? null
        : asNumber(record.averageAudioEnergy, 0),
    usualSource: record.usualSource === "camera" ? "camera" : "upload",
    memoryCount: Math.max(0, asNumber(record.memoryCount, 0)),
    firstMemoryDate:
      record.firstMemoryDate == null
        ? null
        : asTimestamp(record.firstMemoryDate, 0),
    latestMemoryDate:
      record.latestMemoryDate == null
        ? null
        : asTimestamp(record.latestMemoryDate, 0),
  }
}

export function normalizeReplay(rawData: unknown): ReplaySessionView {
  try {
    const raw = asRecord(rawData)
    const metadata = asRecord(raw.metadata)
    const now = Date.now()
    const createdAt = asTimestamp(
      raw.createdAt ?? raw.created_at,
      now
    )
    const id = asString(raw.id, DEFAULT_REPLAY.id)
    const source = asSource(raw.source)
    const videoUrl = asString(
      raw.videoUrl ?? raw.video_url,
      DEFAULT_REPLAY.videoUrl
    )
    const memoryCount = Math.max(
      0,
      asNumber(
        raw.memoryCount ?? metadata.memoryCount,
        DEFAULT_REPLAY.memoryCount
      )
    )
    const timelineEvents = normalizeTimelineEvents(
      raw.timelineEvents ??
        asRecord(raw.memoryState).timelineEvents ??
        metadata.timelineEvents ??
        metadata.timeline ??
        DEFAULT_REPLAY.timelineEvents
    )
    const ambientLine = asString(
      raw.ambientLine ?? metadata.ambientLine,
      DEFAULT_REPLAY.ambientLine
    )
    const contextLine = asString(
      raw.contextLine ?? raw.context ?? metadata.contextLine ?? metadata.context,
      DEFAULT_REPLAY.contextLine
    )
    const archiveStatus = asString(
      raw.archiveStatus ?? metadata.archiveStatus,
      DEFAULT_REPLAY.archiveStatus
    )
    const memoryState = normalizeMemoryState(raw.memoryState, {
      memoryCount,
      archiveStatus,
      ambientLine,
      contextLine,
      timelineEvents,
    })
    const timeline = normalizeTimeline(
      raw.timeline ?? metadata.timeline,
      memoryState?.timelineEvents.length
        ? memoryState.timelineEvents
        : timelineEvents
    )

    return {
      id,
      createdAt,
      source,
      videoUrl,
      title: asString(raw.title, "Axis Session"),
      mission: asString(raw.mission, "None"),
      player: asString(raw.player ?? raw.player_name, "Unassigned"),
      environment: asEnvironment(raw.environment),
      duration: asNumber(raw.duration ?? raw.duration_seconds, 0),
      status: asString(raw.status, DEFAULT_REPLAY.status),
      fileName: asString(raw.fileName ?? raw.file_name, ""),
      tags: asStringArray(raw.tags),
      memoryCount: memoryState?.memoryCount ?? memoryCount,
      lastSignal: asString(
        raw.lastSignal ?? metadata.lastSignal,
        "Replay recovering."
      ),
      archiveStatus: memoryState?.archiveStatus ?? archiveStatus,
      context: contextLine,
      contextLine: memoryState?.contextLine ?? contextLine,
      timeline,
      timelineEvents:
        memoryState?.timelineEvents.length
          ? memoryState.timelineEvents
          : timelineEvents,
      ambientLine: memoryState?.ambientLine ?? ambientLine,
      memoryState,
      signalRead: normalizeSignalRead(raw.signalRead),
      baseline: normalizeBaseline(raw.baseline),
    }
  } catch (error) {
    console.error("AXIS REPLAY NORMALIZE FAILED", error)

    return {
      id: DEFAULT_REPLAY.id,
      createdAt: Date.now(),
      source: "upload",
      videoUrl: DEFAULT_REPLAY.videoUrl,
      title: "Axis Session",
      mission: "None",
      player: "Unassigned",
      environment: "practice",
      duration: 0,
      status: DEFAULT_REPLAY.status,
      fileName: "",
      tags: [],
      memoryCount: DEFAULT_REPLAY.memoryCount,
      lastSignal: "Replay recovering.",
      archiveStatus: DEFAULT_REPLAY.archiveStatus,
      context: DEFAULT_REPLAY.contextLine,
      contextLine: DEFAULT_REPLAY.contextLine,
      timeline: [],
      timelineEvents: DEFAULT_REPLAY.timelineEvents,
      ambientLine: "Replay recovering.",
    }
  }
}

export function normalizeReplayRow(session: AxisReplaySession) {
  return normalizeReplay(session)
}
