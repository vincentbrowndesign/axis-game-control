import { calculateMetrics } from "@/lib/metrics/calculateMetrics"
import { createReplayMoment } from "@/lib/replay/createReplayMoment"
import { calculateRunState } from "@/lib/runs/calculateRunState"
import { elapsedSessionMs, formatClockMs } from "@/lib/session/clock"
import type { SessionEventInput, SessionState } from "@/lib/session/types"
import { createTimelineEvent } from "@/lib/timeline/createTimelineEvent"

export function applySessionEvent({
  state,
  event,
}: {
  state: SessionState
  event: SessionEventInput
}): SessionState {
  const createdAt = Date.now()
  const timestampMs = elapsedSessionMs({
    createdAt: state.createdAt,
    now: createdAt,
    clockEnabled: state.clockEnabled,
    clockMs: state.clockMs,
    periodLengthMs: state.periodLengthMs,
  })
  const eventId = crypto.randomUUID()
  const replayRef = crypto.randomUUID()
  const timelineEvent = createTimelineEvent({
    state,
    event,
    id: eventId,
    createdAt,
    timestampMs,
    gameClock: state.clockEnabled ? formatClockMs(state.clockMs) : formatClockMs(timestampMs),
    replayRef,
  })
  const timeline = [timelineEvent, ...state.timeline]
  const replayMoment = createReplayMoment({
    event: timelineEvent,
    videoUrl: state.playback.videoUrl,
  })
  const sessionMs = Math.max(timestampMs, state.periodLengthMs || 0, 1000)
  const metrics = calculateMetrics({
    events: timeline,
    sessionMs,
  })

  if (event.type === "SCORE") {
    const leftScore =
      event.side === "LEFT"
        ? (state.leftScore || 0) + event.points
        : state.leftScore || 0
    const rightScore =
      event.side === "RIGHT"
        ? (state.rightScore || 0) + event.points
        : state.rightScore || 0

    return {
      ...state,
      leftScore,
      rightScore,
      timeline,
      replayMoments: [replayMoment, ...state.replayMoments],
      metrics,
      runState: calculateRunState(timeline),
      updatedAt: createdAt,
    }
  }

  return {
    ...state,
    makes: (state.makes || 0) + (event.type === "MAKE" ? 1 : 0),
    misses: (state.misses || 0) + (event.type === "MISS" ? 1 : 0),
    timeline,
    replayMoments: [replayMoment, ...state.replayMoments],
    metrics,
    updatedAt: createdAt,
  }
}
