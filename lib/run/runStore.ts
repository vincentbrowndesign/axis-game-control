import {
  createRunId,
  type Run,
  type RunAudioContext,
  type RunInterpretation,
  type RunMedia,
} from "@/lib/run/runState"
import type { RunSignal } from "@/lib/run/signals"

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
          const result: RunSignal["result"] =
            record.result === "miss" ? "miss" : "make"
          const time =
            typeof record.time === "number" && Number.isFinite(record.time)
              ? record.time
              : 0

          return {
            id: typeof record.id === "string" ? record.id : createRunId(),
            side,
            result,
            time,
          }
        })
    : []
  const media: RunMedia | undefined =
    run.media && typeof run.media === "object"
      ? {
          id:
            typeof run.media.id === "string" && run.media.id
              ? run.media.id
              : createRunId(),
          name:
            typeof run.media.name === "string" && run.media.name
              ? run.media.name
              : "Active footage",
          url:
            typeof run.media.url === "string" && run.media.url
              ? run.media.url
              : "",
          durationSeconds:
            typeof run.media.durationSeconds === "number" &&
            Number.isFinite(run.media.durationSeconds)
              ? run.media.durationSeconds
              : 0,
          contentType:
            typeof run.media.contentType === "string" && run.media.contentType
              ? run.media.contentType
              : "video/mp4",
          source: run.media.source === "camera" ? "camera" : "upload",
          attachedAt:
            typeof run.media.attachedAt === "number" && Number.isFinite(run.media.attachedAt)
              ? run.media.attachedAt
              : Date.now(),
        }
      : undefined
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
    moments: Array.isArray(run.moments) ? run.moments : [],
    memories: Array.isArray(run.memories) ? run.memories : [],
    media: media?.url ? media : undefined,
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
