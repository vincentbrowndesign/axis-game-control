import type { StreamMetrics } from "@/lib/session/types"
import type { TimelineEvent } from "@/lib/timeline/types"

export type BehaviorFingerprint = {
  label: string
  value: string
}

export type BehaviorSpurt = {
  kind: "hot" | "empty" | "fast" | "recovery" | "late"
  label: string
  value: string
}

export type BehaviorInference = {
  fingerprints: BehaviorFingerprint[]
  spurts: BehaviorSpurt[]
  rhythmIdentity: string
  pressureStyle: string
  fatigueShape: string
  recoveryLine: string
  predictionLine: string
  archiveLines: string[]
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function seconds(value: number) {
  return Math.max(0, Math.round(value / 1000))
}

function average(values: number[]) {
  if (!values.length) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function eventLabel(event: TimelineEvent) {
  return event.type === "INCREMENT" ? "make" : "miss"
}

function ordered(events: TimelineEvent[], streamId: string) {
  return events
    .filter((event) => event.streamId === streamId)
    .sort((a, b) => a.timestampMs - b.timestampMs)
}

function intervals(events: TimelineEvent[]) {
  return events
    .slice(1)
    .map((event, index) => event.timestampMs - events[index].timestampMs)
}

function variance(values: number[]) {
  if (values.length < 2) return 0

  const mean = average(values)
  const drift =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length

  return Math.sqrt(drift)
}

function rateFor(events: TimelineEvent[], type: TimelineEvent["type"]) {
  if (!events.length) return 0

  return events.filter((event) => event.type === type).length / events.length
}

function lateEvents(events: TimelineEvent[]) {
  if (events.length < 4) return events

  return events.slice(Math.floor(events.length * 0.66))
}

function earlyEvents(events: TimelineEvent[]) {
  if (events.length < 4) return events

  return events.slice(0, Math.ceil(events.length * 0.34))
}

function lateDropoff(events: TimelineEvent[]) {
  const early = earlyEvents(events)
  const late = lateEvents(events)

  return rateFor(early, "INCREMENT") - rateFor(late, "INCREMENT")
}

function streak(events: TimelineEvent[], type: TimelineEvent["type"]) {
  let best = 0
  let current = 0

  for (const event of events) {
    if (event.type === type) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }

  return best
}

function denseWindow(
  events: TimelineEvent[],
  type: TimelineEvent["type"] | "ANY",
  maxWindowMs: number
) {
  const matches = type === "ANY" ? events : events.filter((event) => event.type === type)
  let best = matches.slice(0, 0)

  for (let start = 0; start < matches.length; start += 1) {
    for (let end = start; end < matches.length; end += 1) {
      const span = matches[end].timestampMs - matches[start].timestampMs

      if (span > maxWindowMs) continue

      const candidate = matches.slice(start, end + 1)
      if (candidate.length > best.length) best = candidate
    }
  }

  return best
}

function postMissIntervals(events: TimelineEvent[]) {
  const values: number[] = []

  for (let index = 1; index < events.length; index += 1) {
    if (events[index - 1].type === "DECREMENT") {
      values.push(events[index].timestampMs - events[index - 1].timestampMs)
    }
  }

  return values
}

function recoveryMakeRate(events: TimelineEvent[]) {
  const responses: TimelineEvent[] = []

  for (let index = 1; index < events.length; index += 1) {
    if (events[index - 1].type === "DECREMENT") responses.push(events[index])
  }

  return rateFor(responses, "INCREMENT")
}

function lineOrPending(value: string, attempts: number) {
  return attempts ? value : "Awaiting first attempt"
}

export function buildBehaviorInference({
  events,
  streamId,
  metrics,
}: {
  events: TimelineEvent[]
  streamId: string
  metrics: StreamMetrics
}): BehaviorInference {
  const attempts = ordered(events, streamId)
  const gaps = intervals(attempts)
  const rhythmVariance = variance(gaps)
  const postMiss = postMissIntervals(attempts)
  const postMissAvg = average(postMiss)
  const dropoff = lateDropoff(attempts)
  const hot = denseWindow(attempts, "INCREMENT", 30000)
  const empty = denseWindow(attempts, "DECREMENT", 30000)
  const fast = denseWindow(attempts, "ANY", 15000)
  const recoveryRate = recoveryMakeRate(attempts)
  const late = lateEvents(attempts).filter((event) => event.type === "INCREMENT")
  const lastEvent = attempts[attempts.length - 1]
  const futureDroughtRisk =
    metrics.longestDroughtSeconds > Math.max(18, metrics.avgIntervalSeconds * 2)
      ? "elevated future drought risk"
      : "stable drought risk"
  const rhythmIdentity =
    rhythmVariance <= 2500
      ? "stable rhythm"
      : rhythmVariance <= 6000
        ? "variable rhythm"
        : "drifting rhythm"
  const pressureStyle =
    metrics.rushAfterMissPct > 12
      ? "compressed after misses"
      : metrics.rushAfterMissPct < -12
        ? "resets after misses"
        : "neutral after misses"
  const fatigueShape =
    dropoff > 0.12
      ? `${Math.round(dropoff * 100)}% late dropoff`
      : dropoff < -0.12
        ? `${Math.abs(Math.round(dropoff * 100))}% late lift`
        : "late session stable"
  const recoveryLine =
    attempts.length < 3
      ? "recovery not established"
      : `${pct(recoveryRate)} make response after misses`

  return {
    fingerprints: [
      {
        label: "attempts",
        value: String(metrics.attempts),
      },
      {
        label: "make rate",
        value: lineOrPending(pct(metrics.makeRate), metrics.attempts),
      },
      {
        label: "pace",
        value: `${metrics.attemptsPerMinute}/min attempts`,
      },
      {
        label: "rhythm",
        value: metrics.avgIntervalSeconds
          ? `${metrics.avgIntervalSeconds}s avg interval`
          : "no interval yet",
      },
      {
        label: "drought",
        value: `${metrics.longestDroughtSeconds}s longest`,
      },
      {
        label: "recovery",
        value:
          postMissAvg > 0
            ? `${seconds(postMissAvg)}s after miss`
            : "no miss response yet",
      },
      {
        label: "streak",
        value: `${streak(attempts, "INCREMENT")} make high`,
      },
      {
        label: "collapse",
        value: `${streak(attempts, "DECREMENT")} miss high`,
      },
    ],
    spurts: [
      {
        kind: "hot",
        label: "hot spurt",
        value: hot.length
          ? `${hot.length} makes in ${seconds(
              hot[hot.length - 1].timestampMs - hot[0].timestampMs
            )}s`
          : "not formed",
      },
      {
        kind: "empty",
        label: "empty spurt",
        value: empty.length
          ? `${empty.length} misses in ${seconds(
              empty[empty.length - 1].timestampMs - empty[0].timestampMs
            )}s`
          : "not formed",
      },
      {
        kind: "fast",
        label: "fast spurt",
        value: fast.length
          ? `${fast.length} attempts in ${seconds(
              fast[fast.length - 1].timestampMs - fast[0].timestampMs
            )}s`
          : "not formed",
      },
      {
        kind: "recovery",
        label: "recovery spurt",
        value: recoveryLine,
      },
      {
        kind: "late",
        label: "late spurt",
        value: late.length ? `${late.length} late makes` : "not formed",
      },
    ],
    rhythmIdentity,
    pressureStyle,
    fatigueShape,
    recoveryLine,
    predictionLine: lastEvent
      ? `last signal: ${eventLabel(lastEvent)} at ${lastEvent.elapsedLabel}; ${futureDroughtRisk}`
      : "no forecast yet",
    archiveLines: [
      metrics.intervalRange,
      `${metrics.longestDroughtSeconds}s longest drought`,
      recoveryLine,
      fatigueShape,
      rhythmIdentity,
      futureDroughtRisk,
    ],
  }
}
