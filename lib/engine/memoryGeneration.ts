import { runTemporalEngine } from "@/lib/engine/temporalEngine"
import {
  elapsedRunMs,
  type Run,
  type RunInterpretation,
  type RunMedia,
  type RunMemory,
  type RunMoment,
} from "@/lib/run/runState"
import { scoreFor } from "@/lib/run/score"
import type { RunSignal } from "@/lib/run/signals"

export type ActiveSequence = {
  id: string
  label: string
  title: string
  summary: string
  start: number
  end: number
  signals: RunSignal[]
  media?: RunMedia
  interpretation?: RunInterpretation
}

export type ActiveTemporalSession = {
  id: string
  score: {
    home: number
    away: number
  }
  runtime: number
  signals: RunSignal[]
  sequences: ActiveSequence[]
  moments: RunMoment[]
  footage: RunMedia[]
  memories: RunMemory[]
  temporalState: ReturnType<typeof runTemporalEngine>["state"]
  openAiInterpretations: RunInterpretation[]
}

export function buildActiveTemporalSession(
  run: Run,
  now = Date.now()
): ActiveTemporalSession {
  const temporal = runTemporalEngine(run, now)
  const openAiInterpretations = run.openAiInterpretations ?? []
  const sequences: ActiveSequence[] = temporal.moments.map((moment) => {
    const signals = run.signals.filter((signal) => moment.signalIds.includes(signal.id))
    const interpretation = openAiInterpretations.find((item) =>
      item.signalIds.some((signalId) => moment.signalIds.includes(signalId))
    )

    return {
      id: moment.id,
      label: interpretation?.label || moment.label,
      title: interpretation?.name || moment.name,
      summary: interpretation?.summary || moment.summary,
      start: moment.start,
      end: moment.end,
      signals,
      media: run.media,
      interpretation,
    }
  })

  return {
    id: run.id,
    score: scoreFor(run),
    runtime: elapsedRunMs(run, now),
    signals: run.signals,
    sequences,
    moments: run.moments,
    footage: run.media ? [run.media] : [],
    memories: run.memories,
    temporalState: temporal.state,
    openAiInterpretations,
  }
}
