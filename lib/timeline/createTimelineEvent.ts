import { formatElapsedMs } from "@/lib/session/clock"
import type { SessionEventInput, SessionState } from "@/lib/session/types"
import type { TimelineEvent } from "@/lib/timeline/types"

export function createTimelineEvent({
  state,
  event,
  id,
  replayRef,
  createdAt,
}: {
  state: SessionState
  event: SessionEventInput
  id: string
  replayRef: string
  createdAt: number
}): TimelineEvent {
  const stream = state.streams.find((item) => item.id === event.streamId)

  return {
    id,
    type: event.type,
    streamId: event.streamId,
    streamLabel: stream?.label || "Stream",
    timestampMs: state.elapsedMs,
    elapsedLabel: formatElapsedMs(state.elapsedMs),
    replayTimestamp: event.replayTimestamp,
    replayRef,
    sessionId: state.sessionId,
    createdAt,
  }
}
