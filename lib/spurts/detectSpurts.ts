import type { Spurt } from "@/lib/spurts/types"
import type { TimelineEvent } from "@/lib/timeline/types"

function secondsBetween(startMs: number, endMs: number) {
  return Math.max(0, Math.round((endMs - startMs) / 1000))
}

function spurtId(parts: Array<string | number>) {
  return parts.join("-").toLowerCase().replace(/[^a-z0-9_-]/g, "")
}

function eventsForStream(events: TimelineEvent[], streamId: string) {
  return events
    .filter((event) => event.streamId === streamId)
    .sort((a, b) => a.timestampMs - b.timestampMs)
}

function bestCluster({
  events,
  type,
  windowMs,
}: {
  events: TimelineEvent[]
  type: "MAKE" | "MISS"
  windowMs: number
}) {
  const matches = events.filter((event) => event.type === type)
  let best = matches.slice(0, 1)

  for (let start = 0; start < matches.length; start += 1) {
    const group = matches.filter(
      (event) =>
        event.timestampMs >= matches[start].timestampMs &&
        event.timestampMs - matches[start].timestampMs <= windowMs
    )

    if (
      group.length > best.length ||
      (group.length === best.length &&
        group.length > 1 &&
        secondsBetween(group[0].timestampMs, group[group.length - 1].timestampMs) <
          secondsBetween(best[0].timestampMs, best[best.length - 1].timestampMs))
    ) {
      best = group
    }
  }

  return best
}

function longestRun(events: TimelineEvent[], type: "MAKE" | "MISS") {
  let best: TimelineEvent[] = []
  let current: TimelineEvent[] = []

  for (const event of events) {
    if (event.type === type) {
      current = [...current, event]
    } else {
      if (current.length > best.length) best = current
      current = []
    }
  }

  return current.length > best.length ? current : best
}

function longestGapWithoutMake(events: TimelineEvent[]) {
  const attempts = events.filter(
    (event) => event.type === "MAKE" || event.type === "MISS"
  )
  const makes = attempts.filter((event) => event.type === "MAKE")

  if (!attempts.length) return undefined
  if (!makes.length) {
    return {
      startMs: attempts[0].timestampMs,
      endMs: attempts[attempts.length - 1].timestampMs,
      replayRefs: attempts.map((event) => event.replayRef).filter(Boolean) as string[],
    }
  }

  let best = {
    startMs: attempts[0].timestampMs,
    endMs: makes[0].timestampMs,
    replayRefs: [] as string[],
  }

  for (let index = 1; index < makes.length; index += 1) {
    const gap = {
      startMs: makes[index - 1].timestampMs,
      endMs: makes[index].timestampMs,
      replayRefs: events
        .filter(
          (event) =>
            event.timestampMs >= makes[index - 1].timestampMs &&
            event.timestampMs <= makes[index].timestampMs
        )
        .map((event) => event.replayRef)
        .filter(Boolean) as string[],
    }

    if (gap.endMs - gap.startMs > best.endMs - best.startMs) best = gap
  }

  const lastAttempt = attempts[attempts.length - 1]
  const lastMake = makes[makes.length - 1]

  if (lastAttempt.timestampMs - lastMake.timestampMs > best.endMs - best.startMs) {
    best = {
      startMs: lastMake.timestampMs,
      endMs: lastAttempt.timestampMs,
      replayRefs: events
        .filter(
          (event) =>
            event.timestampMs >= lastMake.timestampMs &&
            event.timestampMs <= lastAttempt.timestampMs
        )
        .map((event) => event.replayRef)
        .filter(Boolean) as string[],
    }
  }

  return best
}

export function detectSpurts(events: TimelineEvent[]): Spurt[] {
  const streamIds = Array.from(new Set(events.map((event) => event.streamId)))
  const spurts: Spurt[] = []

  for (const streamId of streamIds) {
    const streamEvents = eventsForStream(events, streamId)
    const streamLabel = streamEvents[0]?.streamLabel || "Stream"
    const hot = bestCluster({
      events: streamEvents,
      type: "MAKE",
      windowMs: 60_000,
    })
    const empty = bestCluster({
      events: streamEvents,
      type: "MISS",
      windowMs: 60_000,
    })
    const streak = longestRun(streamEvents, "MAKE")
    const drought = longestGapWithoutMake(streamEvents)

    if (hot.length) {
      const seconds = secondsBetween(hot[0].timestampMs, hot[hot.length - 1].timestampMs)
      spurts.push({
        id: spurtId(["hot", streamId, hot[0].timestampMs, hot.length]),
        type: "HOT_SPURT",
        streamId,
        streamLabel,
        count: hot.length,
        seconds,
        startMs: hot[0].timestampMs,
        endMs: hot[hot.length - 1].timestampMs,
        label: "Hot spurt",
        replayRefs: hot.map((event) => event.replayRef).filter(Boolean) as string[],
      })
    }

    if (empty.length) {
      const seconds = secondsBetween(
        empty[0].timestampMs,
        empty[empty.length - 1].timestampMs
      )
      spurts.push({
        id: spurtId(["empty", streamId, empty[0].timestampMs, empty.length]),
        type: "EMPTY_SPURT",
        streamId,
        streamLabel,
        count: empty.length,
        seconds,
        startMs: empty[0].timestampMs,
        endMs: empty[empty.length - 1].timestampMs,
        label: "Empty spurt",
        replayRefs: empty.map((event) => event.replayRef).filter(Boolean) as string[],
      })
    }

    if (streak.length > 1) {
      const seconds = secondsBetween(
        streak[0].timestampMs,
        streak[streak.length - 1].timestampMs
      )
      spurts.push({
        id: spurtId(["streak", streamId, streak[0].timestampMs, streak.length]),
        type: "LONGEST_STREAK",
        streamId,
        streamLabel,
        count: streak.length,
        seconds,
        startMs: streak[0].timestampMs,
        endMs: streak[streak.length - 1].timestampMs,
        label: "Longest streak",
        replayRefs: streak.map((event) => event.replayRef).filter(Boolean) as string[],
      })
    }

    if (drought) {
      const seconds = secondsBetween(drought.startMs, drought.endMs)
      spurts.push({
        id: spurtId(["drought", streamId, drought.startMs, drought.endMs]),
        type: "LONGEST_DROUGHT",
        streamId,
        streamLabel,
        count: 0,
        seconds,
        startMs: drought.startMs,
        endMs: drought.endMs,
        label: "Longest drought",
        replayRefs: drought.replayRefs,
      })
    }
  }

  return spurts
    .filter((spurt) => spurt.count > 1 || spurt.seconds > 0)
    .sort((a, b) => {
      if (a.type === "HOT_SPURT" && b.type !== "HOT_SPURT") return -1
      if (b.type === "HOT_SPURT" && a.type !== "HOT_SPURT") return 1

      return b.endMs - a.endMs
    })
}
