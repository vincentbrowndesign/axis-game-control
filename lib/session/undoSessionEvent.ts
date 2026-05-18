import { calculateMetrics } from "@/lib/metrics/calculateMetrics"
import { calculateRunState } from "@/lib/runs/calculateRunState"
import type { SessionState } from "@/lib/session/types"

export function undoSessionEvent(state: SessionState): SessionState {
  const [latestEvent, ...timeline] = state.timeline

  if (!latestEvent) return state

  const sessionMs = Math.max(
    timeline[0]?.timestampMs || 0,
    state.periodLengthMs || 0,
    1000
  )
  const metrics = calculateMetrics({
    events: timeline,
    sessionMs,
  })
  const replayMoments = state.replayMoments.filter(
    (moment) => moment.eventId !== latestEvent.id
  )

  if (latestEvent.type === "SCORE" && latestEvent.side && latestEvent.points) {
    return {
      ...state,
      leftScore:
        latestEvent.side === "LEFT"
          ? Math.max(0, (state.leftScore || 0) - latestEvent.points)
          : state.leftScore,
      rightScore:
        latestEvent.side === "RIGHT"
          ? Math.max(0, (state.rightScore || 0) - latestEvent.points)
          : state.rightScore,
      timeline,
      replayMoments,
      metrics,
      runState: calculateRunState(timeline),
      updatedAt: Date.now(),
    }
  }

  return {
    ...state,
    makes:
      latestEvent.type === "MAKE" ? Math.max(0, (state.makes || 0) - 1) : state.makes,
    misses:
      latestEvent.type === "MISS"
        ? Math.max(0, (state.misses || 0) - 1)
        : state.misses,
    timeline,
    replayMoments,
    metrics,
    updatedAt: Date.now(),
  }
}
