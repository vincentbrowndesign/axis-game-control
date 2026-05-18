import type { StreamMetrics } from "@/lib/session/types"
import type { TimelineEvent } from "@/lib/timeline/types"

export const emptyStreamMetrics: StreamMetrics = {
  attempts: 0,
  makes: 0,
  misses: 0,
  makeRate: 0,
  makesPerMinute: 0,
  attemptsPerMinute: 0,
  elapsedMs: 0,
  avgIntervalSeconds: 0,
  intervalRange: "No attempts yet.",
  longestStreak: 0,
  longestDroughtSeconds: 0,
  bestSpurt: {
    makes: 0,
    seconds: 0,
  },
  emptySpurt: {
    misses: 0,
    seconds: 0,
  },
  rushAfterMissPct: 0,
}

function average(values: number[]) {
  if (!values.length) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value: number, digits = 1) {
  const scale = 10 ** digits

  return Math.round(value * scale) / scale
}

function seconds(value: number) {
  return Math.max(0, Math.round(value / 1000))
}

function attemptsForStream(events: TimelineEvent[], streamId: string) {
  return events
    .filter((event) => event.streamId === streamId)
    .sort((a, b) => a.timestampMs - b.timestampMs)
}

function longestStreak(events: TimelineEvent[]) {
  let best = 0
  let current = 0

  for (const event of events) {
    if (event.type === "INCREMENT") {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }

  return best
}

function longestDrought(events: TimelineEvent[], elapsedMs: number) {
  if (!events.length) return 0

  const makes = events.filter((event) => event.type === "INCREMENT")

  if (!makes.length) return seconds(elapsedMs || events[events.length - 1].timestampMs)

  let longest = makes[0].timestampMs

  for (let index = 1; index < makes.length; index += 1) {
    longest = Math.max(longest, makes[index].timestampMs - makes[index - 1].timestampMs)
  }

  longest = Math.max(longest, Math.max(0, elapsedMs - makes[makes.length - 1].timestampMs))

  return seconds(longest)
}

function cluster(events: TimelineEvent[], type: "INCREMENT" | "DECREMENT") {
  const matches = events.filter((event) => event.type === type)

  if (!matches.length) {
    return {
      count: 0,
      seconds: 0,
    }
  }

  let best = matches.slice(0, 1)

  for (let start = 0; start < matches.length; start += 1) {
    for (let end = start; end < matches.length; end += 1) {
      const count = end - start + 1
      const span = matches[end].timestampMs - matches[start].timestampMs
      const bestSpan = best[best.length - 1].timestampMs - best[0].timestampMs

      if (count > best.length || (count === best.length && span < bestSpan)) {
        best = matches.slice(start, end + 1)
      }
    }
  }

  return {
    count: best.length,
    seconds: seconds(best[best.length - 1].timestampMs - best[0].timestampMs),
  }
}

function intervalRange(intervals: number[]) {
  if (!intervals.length) return "No attempt rhythm yet."

  const sorted = intervals.map((value) => value / 1000).sort((a, b) => a - b)
  const low = Math.max(0, Math.floor(sorted[Math.floor(sorted.length * 0.25)]))
  const high = Math.max(low + 1, Math.ceil(sorted[Math.floor(sorted.length * 0.75)]))

  return `${low}-${high}s between attempts`
}

function rushAfterMiss(events: TimelineEvent[], intervals: number[]) {
  if (events.length < 3 || !intervals.length) return 0

  const postMissIntervals: number[] = []

  for (let index = 1; index < events.length; index += 1) {
    if (events[index - 1].type === "DECREMENT") {
      postMissIntervals.push(events[index].timestampMs - events[index - 1].timestampMs)
    }
  }

  const normal = average(intervals)
  const afterMiss = average(postMissIntervals)

  if (!normal || !afterMiss) return 0

  return Math.round(((normal - afterMiss) / normal) * 100)
}

export function calculateStreamMetrics({
  events,
  streamId,
  elapsedMs,
}: {
  events: TimelineEvent[]
  streamId: string
  elapsedMs: number
}): StreamMetrics {
  const attempts = attemptsForStream(events, streamId)
  const makes = attempts.filter((event) => event.type === "INCREMENT").length
  const misses = attempts.filter((event) => event.type === "DECREMENT").length
  const intervals = attempts
    .slice(1)
    .map((event, index) => event.timestampMs - attempts[index].timestampMs)
  const hot = cluster(attempts, "INCREMENT")
  const empty = cluster(attempts, "DECREMENT")
  const minutes = elapsedMs > 0 ? elapsedMs / 60000 : 0

  return {
    attempts: attempts.length,
    makes,
    misses,
    makeRate: attempts.length ? makes / attempts.length : 0,
    makesPerMinute: minutes ? round(makes / minutes) : 0,
    attemptsPerMinute: minutes ? round(attempts.length / minutes) : 0,
    elapsedMs,
    avgIntervalSeconds: round(average(intervals) / 1000),
    intervalRange: intervalRange(intervals),
    longestStreak: longestStreak(attempts),
    longestDroughtSeconds: longestDrought(attempts, elapsedMs),
    bestSpurt: {
      makes: hot.count,
      seconds: hot.seconds,
    },
    emptySpurt: {
      misses: empty.count,
      seconds: empty.seconds,
    },
    rushAfterMissPct: rushAfterMiss(attempts, intervals),
  }
}
