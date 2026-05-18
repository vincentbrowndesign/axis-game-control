import type { SessionMetrics } from "@/lib/session/types"
import type { TimelineEvent } from "@/lib/timeline/types"

export const emptyMetrics: SessionMetrics = {
  attempts: 0,
  makes: 0,
  misses: 0,
  makeRate: 0,
  makesPerMinute: 0,
  attemptsPerMinute: 0,
  avgInterval: 0,
  makeStreak: 0,
  missStreak: 0,
  heatWindow: {
    makes: 0,
    seconds: 0,
  },
  droughtSeconds: 0,
  earlyRate: 0,
  lateRate: 0,
  dropoff: 0,
  rushChange: 0,
  rhythmWindow: "No attempt rhythm yet.",
}

function round(value: number, digits = 1) {
  const scale = 10 ** digits

  return Math.round(value * scale) / scale
}

function rate(makes: number, attempts: number) {
  if (!attempts) return 0

  return makes / attempts
}

function average(values: number[]) {
  if (!values.length) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function attemptEvents(events: TimelineEvent[]) {
  return events
    .filter((event) => event.type === "MAKE" || event.type === "MISS")
    .sort((a, b) => a.timestampMs - b.timestampMs)
}

function longestStreak(events: TimelineEvent[], type: "MAKE" | "MISS") {
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

function calculateHeatWindow(events: TimelineEvent[]) {
  const makes = events.filter((event) => event.type === "MAKE")

  if (!makes.length) {
    return {
      makes: 0,
      seconds: 0,
    }
  }

  let bestMakes = 1
  let bestSeconds = 0

  for (let start = 0; start < makes.length; start += 1) {
    for (let end = start; end < makes.length; end += 1) {
      const seconds = Math.max(
        0,
        Math.round((makes[end].timestampMs - makes[start].timestampMs) / 1000)
      )
      const count = end - start + 1

      if (
        count > bestMakes ||
        (count === bestMakes && (bestSeconds === 0 || seconds < bestSeconds))
      ) {
        bestMakes = count
        bestSeconds = seconds
      }
    }
  }

  return {
    makes: bestMakes,
    seconds: bestSeconds,
  }
}

function calculateDrought(events: TimelineEvent[], sessionSeconds: number) {
  const attempts = attemptEvents(events)
  const makes = attempts.filter((event) => event.type === "MAKE")

  if (!attempts.length) return 0
  if (!makes.length) return Math.max(0, Math.round(sessionSeconds))

  let longest = Math.max(0, makes[0].timestampMs - attempts[0].timestampMs)

  for (let index = 1; index < makes.length; index += 1) {
    longest = Math.max(longest, makes[index].timestampMs - makes[index - 1].timestampMs)
  }

  const lastAttempt = attempts[attempts.length - 1]
  const lastMake = makes[makes.length - 1]
  longest = Math.max(longest, lastAttempt.timestampMs - lastMake.timestampMs)

  return Math.round(longest / 1000)
}

function splitRates(events: TimelineEvent[], sessionMs: number) {
  if (!events.length || sessionMs <= 0) {
    return {
      earlyRate: 0,
      lateRate: 0,
    }
  }

  const third = sessionMs / 3
  const early = events.filter((event) => event.timestampMs <= third)
  const late = events.filter((event) => event.timestampMs > third * 2)
  const earlyMakes = early.filter((event) => event.type === "MAKE").length
  const lateMakes = late.filter((event) => event.type === "MAKE").length

  return {
    earlyRate: rate(earlyMakes, early.length),
    lateRate: rate(lateMakes, late.length),
  }
}

function calculateRushChange(events: TimelineEvent[], intervals: number[]) {
  if (events.length < 3 || !intervals.length) return 0

  const postMissIntervals: number[] = []

  for (let index = 1; index < events.length; index += 1) {
    if (events[index - 1].type === "MISS") {
      postMissIntervals.push(events[index].timestampMs - events[index - 1].timestampMs)
    }
  }

  const normal = average(intervals)
  const postMiss = average(postMissIntervals)

  if (!normal || !postMiss) return 0

  return round(((normal - postMiss) / normal) * 100, 0)
}

function rhythmWindow(intervals: number[]) {
  if (!intervals.length) return "No attempt rhythm yet."

  const seconds = intervals.map((interval) => interval / 1000).sort((a, b) => a - b)
  const middle = seconds[Math.floor(seconds.length / 2)]
  const low = Math.max(0, Math.floor(middle))
  const high = Math.max(low + 1, Math.ceil(middle))

  return `Most attempts came every ${low}-${high} seconds.`
}

export function calculateMetrics({
  events,
  sessionMs,
}: {
  events: TimelineEvent[]
  sessionMs: number
}): SessionMetrics {
  const attempts = attemptEvents(events)
  const makes = attempts.filter((event) => event.type === "MAKE").length
  const misses = attempts.filter((event) => event.type === "MISS").length
  const intervals = attempts
    .slice(1)
    .map((event, index) => event.timestampMs - attempts[index].timestampMs)
  const sessionSeconds = Math.max(1, sessionMs / 1000)
  const sessionMinutes = sessionSeconds / 60
  const { earlyRate, lateRate } = splitRates(attempts, sessionMs)

  return {
    attempts: attempts.length,
    makes,
    misses,
    makeRate: rate(makes, attempts.length),
    makesPerMinute: round(makes / sessionMinutes),
    attemptsPerMinute: round(attempts.length / sessionMinutes),
    avgInterval: round(average(intervals) / 1000),
    makeStreak: longestStreak(attempts, "MAKE"),
    missStreak: longestStreak(attempts, "MISS"),
    heatWindow: calculateHeatWindow(attempts),
    droughtSeconds: calculateDrought(attempts, sessionSeconds),
    earlyRate,
    lateRate,
    dropoff: earlyRate - lateRate,
    rushChange: calculateRushChange(attempts, intervals),
    rhythmWindow: rhythmWindow(intervals),
  }
}
