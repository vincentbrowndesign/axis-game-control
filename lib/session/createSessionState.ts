import { emptyStreamMetrics } from "@/lib/metrics/calculateMetrics"
import type { SessionSetupInput, SessionState, Stream } from "@/lib/session/types"

function cleanLabel(value: string, fallback: string) {
  const clean = value.trim()

  return clean || fallback
}

function createStream(label: string, index: number): Stream {
  return {
    id: crypto.randomUUID(),
    label: cleanLabel(label, `Stream ${index + 1}`),
    attempts: 0,
    makes: 0,
    misses: 0,
    metrics: emptyStreamMetrics,
  }
}

export function createSessionState(input: SessionSetupInput): SessionState {
  const now = Date.now()
  const streams = input.streamLabels.length
    ? input.streamLabels.map(createStream)
    : ["Black", "Gold"].map(createStream)

  return {
    sessionId: crypto.randomUUID(),
    sessionName: cleanLabel(input.sessionName, "Basketball ledger"),
    createdAt: now,
    updatedAt: now,
    elapsedMs: 0,
    timerRunning: false,
    activeStreamId: streams[0].id,
    streams,
    timeline: [],
    spurts: [],
    replayMoments: [],
    progression: [],
    playback: {
      durationSeconds: 0,
    },
  }
}
