import type { ProgressionSignal } from "@/lib/progression/types"
import type { StoredSessionSummary, Stream } from "@/lib/session/types"

function signal(id: string, label: string): ProgressionSignal {
  return {
    id,
    label,
  }
}

export function compareSessions({
  current,
  previous,
}: {
  current: Stream
  previous?: StoredSessionSummary
}): ProgressionSignal[] {
  const prior = previous?.streams.find(
    (stream) => stream.label.toLowerCase() === current.label.toLowerCase()
  )

  if (!prior || current.metrics.attempts < 3) {
    return [signal("baseline", "Building this stream's baseline.")]
  }

  const signals: ProgressionSignal[] = []
  const currentMetrics = current.metrics
  const priorMetrics = prior.metrics

  if (currentMetrics.rushAfterMissPct < priorMetrics.rushAfterMissPct) {
    signals.push(signal("less-rush", "Fewer rushed attempts after misses."))
  }

  if (currentMetrics.longestStreak > priorMetrics.longestStreak) {
    signals.push(signal("longer-streak", "Longer make streak than last session."))
  }

  if (
    priorMetrics.longestDroughtSeconds > 0 &&
    currentMetrics.longestDroughtSeconds < priorMetrics.longestDroughtSeconds
  ) {
    signals.push(signal("shorter-drought", "Shorter longest drought than last session."))
  }

  if (currentMetrics.makeRate > priorMetrics.makeRate) {
    signals.push(signal("better-rate", "Higher make rate than last session."))
  }

  return signals.length ? signals : [signal("steady", "No progression shift yet.")]
}
