import type { SessionEventInput, SessionState } from "@/lib/session/types"
import type { TimelineEvent } from "@/lib/timeline/types"

function eventLabel(event: SessionEventInput, sideLabel?: string) {
  if (event.type === "SCORE") return `${sideLabel || "Side"} +${event.points}`
  if (event.type === "MAKE") return "Make recorded."

  return "Miss recorded."
}

export function createTimelineEvent({
  state,
  event,
  id,
  createdAt,
  timestampMs,
  gameClock,
  replayRef,
}: {
  state: SessionState
  event: SessionEventInput
  id: string
  createdAt: number
  timestampMs: number
  gameClock: string
  replayRef: string
}): TimelineEvent {
  const sideLabel =
    event.type === "SCORE"
      ? event.side === "LEFT"
        ? state.leftLabel
        : state.rightLabel
      : undefined

  return {
    id,
    type: event.type,
    side: event.type === "SCORE" ? event.side : undefined,
    sideLabel,
    points: event.type === "SCORE" ? event.points : undefined,
    timestampMs,
    gameClock,
    period: state.period,
    createdAt,
    replayTimestamp: event.replayTimestamp,
    sessionId: state.sessionId,
    replayRef,
    label: eventLabel(event, sideLabel),
  }
}
