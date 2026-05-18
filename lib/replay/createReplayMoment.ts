import type { ReplayMoment } from "@/lib/replay/types"
import type { TimelineEvent } from "@/lib/timeline/types"

export function createReplayMoment({
  event,
  videoUrl,
}: {
  event: TimelineEvent
  videoUrl?: string
}): ReplayMoment {
  return {
    id: event.replayRef || crypto.randomUUID(),
    sessionId: event.sessionId,
    eventId: event.id,
    timestampMs: event.timestampMs,
    replayTimestamp: event.replayTimestamp,
    eventType: event.type,
    label: `${event.streamLabel} ${event.type.toLowerCase()}`,
    videoUrl,
    createdAt: event.createdAt,
  }
}
