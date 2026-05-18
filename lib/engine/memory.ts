import type { Run, RunMemory, RunMoment } from "@/lib/run/runState"
import type { RunSignal } from "@/lib/run/signals"

function momentId(parts: Array<string | number>) {
  return parts.join("-").toLowerCase().replace(/[^a-z0-9_-]/g, "")
}

function labelCluster(signals: RunSignal[]) {
  const first = signals[0]
  const makes = signals.filter((signal) => signal.result === "make").length
  const misses = signals.filter((signal) => signal.result === "miss").length
  const sameSide = signals.filter((signal) => signal.side === first?.side).length
  const alternations = signals.filter(
    (signal, index) => index > 0 && signal.side !== signals[index - 1].side
  ).length

  if (!first) return "Moment"
  if (sameSide >= 3 && makes >= 3) return `${first.side.toUpperCase()} HOT SPURT`
  if (misses >= 3) return "COLD WINDOW"
  if (alternations >= 2) return "VOLATILE SHIFT"

  return `${first.side.toUpperCase()} SHIFT`
}

export function buildMoments(signals: RunSignal[]): RunMoment[] {
  const moments: RunMoment[] = []

  for (let start = 0; start < signals.length; start += 1) {
    const cluster = [signals[start]]

    for (let end = start + 1; end < signals.length; end += 1) {
      const next = signals[end]
      const first = cluster[0]

      if (next.time - first.time > 45_000) break
      if (
        next.side === first.side ||
        next.result === first.result ||
        next.time - cluster[cluster.length - 1].time <= 8_000
      ) {
        cluster.push(next)
      }
    }

    if (cluster.length >= 3) {
      const first = cluster[0]
      const last = cluster[cluster.length - 1]

      moments.push({
        id: momentId([first.id, last.id, cluster.length]),
        label: labelCluster(cluster),
        start: first.time,
        end: last.time,
        time: last.time,
      })
    }
  }

  return moments
    .filter(
      (moment, index, list) =>
        list.findIndex((item) => item.id === moment.id) === index
    )
    .sort((a, b) => b.time - a.time)
    .slice(0, 6)
}

export function buildMemories(run: Run, playbackId?: string): RunMemory[] {
  return run.moments.slice(0, 4).map((moment) => ({
    id: `memory-${moment.id}`,
    start: moment.start,
    end: moment.end,
    signals: run.signals.filter(
      (signal) => signal.time >= moment.start && signal.time <= moment.end
    ),
    playbackId: playbackId || run.media?.url,
    mediaId: run.media?.id,
    momentId: moment.id,
    temporalLabel: moment.label,
    interpretation:
      run.openAiInterpretations?.find((item) =>
        item.signalIds.some((signalId) =>
          run.signals.some(
            (signal) =>
              signal.id === signalId &&
              signal.time >= moment.start &&
              signal.time <= moment.end
          )
        )
      )?.summary || moment.label,
  }))
}
