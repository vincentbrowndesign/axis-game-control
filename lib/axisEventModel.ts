import type { BasketballEvent, ContinuityAssistSample } from "@/lib/continuityAssistance"
import type { LiveStatTeam } from "@/lib/liveBasketballStats"

export type AxisEventSource = "tap" | "replay" | "upload"

export type AxisReplayAnchor = {
  sessionTime: number
  clipStart: number
  clipEnd: number
  snapshotId: string | null
}

export type AxisTrainingSignal = {
  source: AxisEventSource
  confidence: number
  sequenceIndex: number
  previousEvents: BasketballEvent[]
  replayPosition: number
  scoreState: {
    home: number
    away: number
  }
  continuity: {
    pressure: number | null
    density: number | null
    attentionState: string | null
  }
}

export type AxisGameEvent = {
  id: string
  sessionId: string
  type: BasketballEvent
  team: LiveStatTeam
  player: string | null
  timestamp: number
  points: number
  score: {
    home: number
    away: number
  }
  replayAnchor: AxisReplayAnchor
  playByPlay: string
  training: AxisTrainingSignal
}

export function trainingSignalFromTap({
  sequenceIndex,
  previousEvents,
  replayPosition,
  scoreState,
  continuity,
}: {
  sequenceIndex: number
  previousEvents: BasketballEvent[]
  replayPosition: number
  scoreState: AxisTrainingSignal["scoreState"]
  continuity: ContinuityAssistSample | null
}): AxisTrainingSignal {
  return {
    source: "tap",
    confidence: 1,
    sequenceIndex,
    previousEvents,
    replayPosition,
    scoreState,
    continuity: {
      pressure: continuity?.pressure ?? null,
      density: continuity?.kineticDensity ?? null,
      attentionState: continuity?.attentionState ?? null,
    },
  }
}
