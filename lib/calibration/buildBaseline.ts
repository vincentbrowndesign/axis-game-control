import type { ExtractedReplaySignals } from "@/lib/signals/types"
import type { ReplaySessionView, SessionSource } from "@/types/memory"
import type { CalibrationBaseline } from "./types"

function average(values: number[]) {
  if (!values.length) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function averageNullable(values: (number | null | undefined)[]) {
  const realValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value)
  )

  if (!realValues.length) return null

  return average(realValues)
}

function usualSource(sessions: ReplaySessionView[]): SessionSource {
  const counts = sessions.reduce<Record<SessionSource, number>>(
    (state, session) => {
      state[session.source] += 1

      return state
    },
    {
      upload: 0,
      camera: 0,
    }
  )

  return counts.camera > counts.upload ? "camera" : "upload"
}

export function buildBaseline({
  session,
  previousSessions = [],
  signals,
}: {
  session: ReplaySessionView
  previousSessions?: ReplaySessionView[]
  signals?: ExtractedReplaySignals | null
}): CalibrationBaseline {
  const sessions = [...previousSessions, session]
  const memoryCount = sessions.length
  const dates = sessions
    .map((item) => item.createdAt)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)

  return {
    status:
      memoryCount <= 1
        ? "BASELINE STARTED"
        : signals?.motionIntensity == null
          ? "NOT ENOUGH MEMORY"
          : "MEMORY ADDED",
    averageSessionDuration: average(
      sessions.map((item) => item.duration || 0)
    ),
    averageMotionIntensity: averageNullable([
      signals?.motionIntensity,
      ...previousSessions.map(
        (item) => item.signalRead?.motionIntensity
      ),
    ]),
    averageAudioEnergy: averageNullable([
      signals?.audioEnergy,
      ...previousSessions.map((item) => item.signalRead?.audioEnergy),
    ]),
    usualSource: usualSource(sessions),
    memoryCount,
    firstMemoryDate: dates[0] ?? null,
    latestMemoryDate: dates[dates.length - 1] ?? null,
  }
}
