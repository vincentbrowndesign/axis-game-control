import { calculateStreamMetrics } from "@/lib/metrics/calculateMetrics"
import { detectSpurts } from "@/lib/spurts/detectSpurts"
import type { SessionState } from "@/lib/session/types"

export function undoSessionEvent(state: SessionState): SessionState {
  const [latestEvent, ...timeline] = state.timeline

  if (!latestEvent) return state

  const streams = state.streams.map((stream) => {
    if (stream.id !== latestEvent.streamId) {
      return {
        ...stream,
        metrics: calculateStreamMetrics({
          events: timeline,
          streamId: stream.id,
          elapsedMs: state.elapsedMs,
        }),
      }
    }

    const makes = Math.max(
      0,
      stream.makes - (latestEvent.type === "MAKE" ? 1 : 0)
    )
    const misses = Math.max(
      0,
      stream.misses - (latestEvent.type === "MISS" ? 1 : 0)
    )

    return {
      ...stream,
      attempts: makes + misses,
      makes,
      misses,
      metrics: calculateStreamMetrics({
        events: timeline,
        streamId: stream.id,
        elapsedMs: state.elapsedMs,
      }),
    }
  })

  return {
    ...state,
    streams,
    timeline,
    spurts: detectSpurts(timeline),
    replayMoments: state.replayMoments.filter(
      (moment) => moment.eventId !== latestEvent.id
    ),
    updatedAt: Date.now(),
  }
}
