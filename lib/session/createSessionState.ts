import { emptyMetrics } from "@/lib/metrics/calculateMetrics"
import { minutesToMs } from "@/lib/session/clock"
import type { SessionSetupInput, SessionState } from "@/lib/session/types"

function cleanName(value: string, fallback: string) {
  const clean = value.trim()

  return clean || fallback
}

function cleanNumber(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0

  return Math.max(0, Math.floor(value))
}

export function createSessionState(input: SessionSetupInput): SessionState {
  const now = Date.now()
  const clockMs =
    input.mode === "GAME"
      ? minutesToMs(input.periodLengthMinutes, 8)
      : minutesToMs(input.durationMinutes, 5)

  const base = {
    sessionId: crypto.randomUUID(),
    mode: input.mode,
    sessionName:
      input.mode === "GAME"
        ? cleanName(input.sessionName, "Basketball run")
        : cleanName(input.drillName, "Rep work"),
    clockMs,
    clockRunning: false,
    clockEnabled: input.clockEnabled,
    periodLengthMs: clockMs,
    timeline: [],
    replayMoments: [],
    metrics: emptyMetrics,
    runState: {
      side: null,
      pointsFor: 0,
      pointsAgainst: 0,
      label: "RUN: 0-0",
    },
    playback: {
      durationSeconds: 0,
    },
    createdAt: now,
    updatedAt: now,
  } satisfies SessionState

  if (input.mode === "REP") {
    return {
      ...base,
      makes: 0,
      misses: 0,
      targetMakes: cleanNumber(input.targetMakes),
    }
  }

  return {
    ...base,
    leftLabel: cleanName(input.leftLabel, "Black"),
    rightLabel: cleanName(input.rightLabel, "Gold"),
    leftScore: cleanNumber(input.startingLeftScore),
    rightScore: cleanNumber(input.startingRightScore),
    period: 1,
  }
}
