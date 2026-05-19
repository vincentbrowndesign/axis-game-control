import {
  createRunId,
  type Run,
  type RunAudioContext,
  type RunInterpretation,
  type RunMedia,
  type RunPlayer,
  type RunScoreEvent,
  type RunStoryBlock,
} from "@/lib/run/runState"
import type { RunSignal } from "@/lib/run/signals"
import {
  normalizeSignalResult,
  normalizeSignalStat,
  polarityForResult,
} from "@/lib/run/signals"

export const activeRunKey = "axis-active-run"
export const storedRunsKey = "axis-stored-runs"
export const temporalRunEventName = "axis-temporal-run"
const temporalRunChannelName = "axis-temporal-run-channel"

type TemporalRunListener = (run: Run) => void

function publishTemporalRun(run: Run) {
  if (typeof window === "undefined") return

  try {
    window.dispatchEvent(
      new CustomEvent<Run>(temporalRunEventName, {
        detail: run,
      })
    )
  } catch {
    // Keep capture stable if CustomEvent is unavailable.
  }

  try {
    if (typeof BroadcastChannel === "undefined") return

    const channel = new BroadcastChannel(temporalRunChannelName)
    channel.postMessage(run)
    channel.close()
  } catch {
    // BroadcastChannel is optional, especially on older mobile browsers.
  }
}

function normalizeRun(value: unknown): Run | null {
  if (!value || typeof value !== "object") return null

  const run = value as Partial<Run>
  const id = typeof run.id === "string" ? run.id : createRunId()
  const home = typeof run.home === "string" && run.home ? run.home : "Home"
  const away = typeof run.away === "string" && run.away ? run.away : "Away"
  const startedAt =
    typeof run.startedAt === "number" && Number.isFinite(run.startedAt)
      ? run.startedAt
      : Date.now()
  const pausedAt =
    typeof run.pausedAt === "number" && Number.isFinite(run.pausedAt)
      ? run.pausedAt
      : undefined
  const pausedMs =
    typeof run.pausedMs === "number" && Number.isFinite(run.pausedMs)
      ? run.pausedMs
      : 0
  const signals: RunSignal[] = Array.isArray(run.signals)
    ? run.signals
        .filter((signal) => signal && typeof signal === "object")
        .map((signal) => {
          const record = signal as Partial<RunSignal>
          const side: RunSignal["side"] = record.side === "away" ? "away" : "home"
          const result = normalizeSignalResult(record.result)
          const stat = normalizeSignalStat(record.stat, result)
          const time =
            typeof record.time === "number" && Number.isFinite(record.time)
              ? record.time
              : 0

          return {
            id: typeof record.id === "string" ? record.id : createRunId(),
            side,
            result,
            polarity: record.polarity === "MINUS" ? "MINUS" : polarityForResult(result),
            stat,
            playerId: typeof record.playerId === "string" ? record.playerId : undefined,
            time,
          }
        })
    : []
  const players: RunPlayer[] = Array.isArray(run.players)
    ? run.players
        .filter((player) => player && typeof player === "object")
        .map((player) => {
          const record = player as Partial<RunPlayer>
          const team: RunPlayer["team"] = record.team === "away" ? "away" : "home"

          return {
            id: typeof record.id === "string" ? record.id : createRunId(),
            team,
            number:
              typeof record.number === "string" && record.number.trim()
                ? record.number.trim().slice(0, 4)
                : "0",
            name:
              typeof record.name === "string" && record.name.trim()
                ? record.name.trim().slice(0, 24)
                : undefined,
          }
        })
        .slice(0, 24)
    : []
  const scoreEvents: RunScoreEvent[] = Array.isArray(run.scoreEvents)
    ? run.scoreEvents
        .filter((event) => event && typeof event === "object")
        .map((event) => {
          const record = event as Partial<RunScoreEvent>
          const team: RunScoreEvent["team"] = record.team === "away" ? "away" : "home"

          return {
            id: typeof record.id === "string" ? record.id : createRunId(),
            team,
            signalId: typeof record.signalId === "string" ? record.signalId : undefined,
            points:
              typeof record.points === "number" && Number.isFinite(record.points)
                ? record.points
                : 0,
            timestamp:
              typeof record.timestamp === "number" && Number.isFinite(record.timestamp)
                ? record.timestamp
                : 0,
          }
        })
        .filter((event) => event.points > 0)
    : []
  const normalizeMedia = (value: unknown): RunMedia | undefined => {
    if (!value || typeof value !== "object") return undefined

    const media = value as Partial<RunMedia>

    return {
      id: typeof media.id === "string" && media.id ? media.id : createRunId(),
      name:
        typeof media.name === "string" && media.name
          ? media.name
          : "Story memory",
      url: typeof media.url === "string" && media.url ? media.url : "",
      durationSeconds:
        typeof media.durationSeconds === "number" &&
        Number.isFinite(media.durationSeconds)
          ? media.durationSeconds
          : 0,
      contentType:
        typeof media.contentType === "string" && media.contentType
          ? media.contentType
          : "video/mp4",
      source: media.source === "camera" ? "camera" : "upload",
      attachedAt:
        typeof media.attachedAt === "number" && Number.isFinite(media.attachedAt)
          ? media.attachedAt
          : Date.now(),
    }
  }
  const media = normalizeMedia(run.media)
  const storyBlocks: RunStoryBlock[] = Array.isArray(run.storyBlocks)
    ? run.storyBlocks
        .filter((block) => block && typeof block === "object")
        .flatMap((block) => {
          const record = block as Partial<RunStoryBlock>
          const blockMedia = normalizeMedia(record.media)

          if (!blockMedia?.url) return []

          return [
            {
              id: typeof record.id === "string" && record.id ? record.id : createRunId(),
              media: blockMedia,
              start:
                typeof record.start === "number" && Number.isFinite(record.start)
                  ? record.start
                  : 0,
              end:
                typeof record.end === "number" && Number.isFinite(record.end)
                  ? record.end
                  : 0,
              capturedAt:
                typeof record.capturedAt === "number" && Number.isFinite(record.capturedAt)
                  ? record.capturedAt
                  : Date.now(),
              score: {
                home:
                  typeof record.score?.home === "number" &&
                  Number.isFinite(record.score.home)
                    ? record.score.home
                    : 0,
                away:
                  typeof record.score?.away === "number" &&
                  Number.isFinite(record.score.away)
                    ? record.score.away
                    : 0,
              },
              continuityLabel:
                typeof record.continuityLabel === "string" && record.continuityLabel
                  ? record.continuityLabel
                  : "FLOW",
              sticker:
                typeof record.sticker === "string" && record.sticker
                  ? record.sticker
                  : "MOMENT",
              signalIds: Array.isArray(record.signalIds)
                ? record.signalIds.filter((id): id is string => typeof id === "string")
                : [],
              audioIntensity:
                typeof record.audioIntensity === "number" &&
                Number.isFinite(record.audioIntensity)
                  ? Math.max(0, Math.min(1, record.audioIntensity))
                  : 0,
              buffer: {
                preRollSeconds:
                  typeof record.buffer?.preRollSeconds === "number" &&
                  Number.isFinite(record.buffer.preRollSeconds)
                    ? record.buffer.preRollSeconds
                    : 4,
                tailSeconds:
                  typeof record.buffer?.tailSeconds === "number" &&
                  Number.isFinite(record.buffer.tailSeconds)
                    ? record.buffer.tailSeconds
                    : 2,
              },
            },
          ]
        })
        .slice(-24)
    : []
  const openAiInterpretations: RunInterpretation[] = Array.isArray(
    run.openAiInterpretations
  )
    ? run.openAiInterpretations
        .filter((interpretation) => interpretation && typeof interpretation === "object")
        .map((interpretation) => {
          const record = interpretation as Partial<RunInterpretation>
          const source: RunInterpretation["source"] =
            record.source === "openai" ? "openai" : "local"

          return {
            id: typeof record.id === "string" ? record.id : createRunId(),
            label:
              typeof record.label === "string" && record.label
                ? record.label
                : "HOT",
            name:
              typeof record.name === "string" && record.name
                ? record.name
                : "Sequence",
            summary:
              typeof record.summary === "string" && record.summary
                ? record.summary
                : "Temporal sequence",
            start:
              typeof record.start === "number" && Number.isFinite(record.start)
                ? record.start
                : 0,
            end:
              typeof record.end === "number" && Number.isFinite(record.end)
                ? record.end
                : 0,
            signalIds: Array.isArray(record.signalIds)
              ? record.signalIds.filter((id): id is string => typeof id === "string")
              : [],
            source,
            generatedAt:
              typeof record.generatedAt === "number" && Number.isFinite(record.generatedAt)
                ? record.generatedAt
                : Date.now(),
          }
        })
        .slice(0, 8)
    : []
  const audioContext: RunAudioContext | undefined =
    run.audioContext && typeof run.audioContext === "object"
      ? {
          id:
            typeof run.audioContext.id === "string" && run.audioContext.id
              ? run.audioContext.id
              : createRunId(),
          source: "deepgram",
          speechSegments: Array.isArray(run.audioContext.speechSegments)
            ? run.audioContext.speechSegments
                .filter((segment) => segment && typeof segment === "object")
                .map((segment) => {
                  const record = segment as Partial<
                    RunAudioContext["speechSegments"][number]
                  >

                  return {
                    start:
                      typeof record.start === "number" && Number.isFinite(record.start)
                        ? record.start
                        : 0,
                    end:
                      typeof record.end === "number" && Number.isFinite(record.end)
                        ? record.end
                        : 0,
                    confidence:
                      typeof record.confidence === "number" &&
                      Number.isFinite(record.confidence)
                        ? record.confidence
                        : 0,
                  }
                })
                .slice(0, 80)
            : [],
          silenceWindows: Array.isArray(run.audioContext.silenceWindows)
            ? run.audioContext.silenceWindows
                .filter((window) => window && typeof window === "object")
                .map((window) => {
                  const record = window as Partial<
                    RunAudioContext["silenceWindows"][number]
                  >

                  return {
                    start:
                      typeof record.start === "number" && Number.isFinite(record.start)
                        ? record.start
                        : 0,
                    end:
                      typeof record.end === "number" && Number.isFinite(record.end)
                        ? record.end
                        : 0,
                    duration:
                      typeof record.duration === "number" &&
                      Number.isFinite(record.duration)
                        ? record.duration
                        : 0,
                  }
                })
                .slice(0, 80)
            : [],
          pacing:
            typeof run.audioContext.pacing === "number" &&
            Number.isFinite(run.audioContext.pacing)
              ? run.audioContext.pacing
              : 0,
          interruptionCount:
            typeof run.audioContext.interruptionCount === "number" &&
            Number.isFinite(run.audioContext.interruptionCount)
              ? run.audioContext.interruptionCount
              : 0,
          escalation:
            typeof run.audioContext.escalation === "number" &&
            Number.isFinite(run.audioContext.escalation)
              ? run.audioContext.escalation
              : 0,
          generatedAt:
            typeof run.audioContext.generatedAt === "number" &&
            Number.isFinite(run.audioContext.generatedAt)
              ? run.audioContext.generatedAt
              : Date.now(),
        }
      : undefined

  return {
    id,
    home,
    away,
    startedAt,
    pausedAt,
    pausedMs,
    signals,
    scoreEvents,
    players,
    moments: Array.isArray(run.moments) ? run.moments : [],
    memories: Array.isArray(run.memories) ? run.memories : [],
    media: media?.url ? media : undefined,
    storyBlocks,
    openAiInterpretations,
    audioContext,
  }
}

export function readStoredRun(): Run | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(activeRunKey)

    return raw ? normalizeRun(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function writeStoredRun(run: Run) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(activeRunKey, JSON.stringify(run))
    publishTemporalRun(run)
  } catch {
    // Mobile Safari can deny storage in constrained/private contexts.
    publishTemporalRun(run)
  }
}

export function readStoredRuns(): Run[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(storedRunsKey)

    if (!raw) return []

    const parsed = JSON.parse(raw)

    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          const run = normalizeRun(item)

          return run ? [run] : []
        })
      : []
  } catch {
    return []
  }
}

export function storeRun(run: Run) {
  if (typeof window === "undefined") return

  try {
    const stored = readStoredRuns()
    const next = [run, ...stored.filter((item) => item.id !== run.id)].slice(0, 12)

    window.localStorage.setItem(storedRunsKey, JSON.stringify(next))
    window.localStorage.setItem(activeRunKey, JSON.stringify(run))
    publishTemporalRun(run)
  } catch {
    // Keep the live screen running even when persistent storage is unavailable.
    publishTemporalRun(run)
  }
}

export function subscribeTemporalRun(listener: TemporalRunListener) {
  if (typeof window === "undefined") return () => {}

  const onEvent = (event: Event) => {
    const run = (event as CustomEvent<Run>).detail

    if (run) listener(run)
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== activeRunKey) return

    const run = readStoredRun()

    if (run) listener(run)
  }
  let channel: BroadcastChannel | null = null

  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(temporalRunChannelName)
      channel.onmessage = (event: MessageEvent<Run>) => {
        if (event.data) listener(event.data)
      }
    }
  } catch {
    channel = null
  }

  window.addEventListener(temporalRunEventName, onEvent)
  window.addEventListener("storage", onStorage)

  return () => {
    window.removeEventListener(temporalRunEventName, onEvent)
    window.removeEventListener("storage", onStorage)
    channel?.close()
  }
}
