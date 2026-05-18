import { calculateStreamMetrics } from "@/lib/metrics/calculateMetrics"
import { createReplayMoment } from "@/lib/replay/createReplayMoment"
import type { ProgressionSignal } from "@/lib/progression/types"
import { detectSpurts } from "@/lib/spurts/detectSpurts"
import type { SessionEventInput, SessionState } from "@/lib/session/types"
import { createTimelineEvent } from "@/lib/timeline/createTimelineEvent"

function updateStreams({
  state,
  event,
  timeline,
}: {
  state: SessionState
  event: SessionEventInput
  timeline: SessionState["timeline"]
}) {
  return state.streams.map((stream) => {
    if (stream.id !== event.streamId) {
      return {
        ...stream,
        metrics: calculateStreamMetrics({
          events: timeline,
          streamId: stream.id,
          elapsedMs: state.elapsedMs,
        }),
      }
    }

    const makes = stream.makes + (event.type === "MAKE" ? 1 : 0)
    const misses = stream.misses + (event.type === "MISS" ? 1 : 0)

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
}

export function applySessionEvent({
  state,
  event,
  progression = state.progression,
}: {
  state: SessionState
  event: SessionEventInput
  progression?: ProgressionSignal[]
}): SessionState {
  const createdAt = Date.now()
  const eventId = crypto.randomUUID()
  const replayRef = crypto.randomUUID()
  const timelineEvent = createTimelineEvent({
    state,
    event,
    id: eventId,
    replayRef,
    createdAt,
  })
  const timeline = [timelineEvent, ...state.timeline]
  const streams = updateStreams({
    state,
    event,
    timeline,
  })
  const replayMoment = createReplayMoment({
    event: timelineEvent,
    videoUrl: state.playback.videoUrl,
  })

  return {
    ...state,
    streams,
    timeline,
    spurts: detectSpurts(timeline),
    replayMoments: [replayMoment, ...state.replayMoments],
    progression,
    updatedAt: createdAt,
  }
}
