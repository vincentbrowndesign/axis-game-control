import { createRunId, type RunAudioContext } from "@/lib/run/runState"

type DeepgramWord = {
  start?: number
  end?: number
  confidence?: number
}

type DeepgramUtterance = {
  start?: number
  end?: number
  confidence?: number
  words?: DeepgramWord[]
}

type DeepgramResponse = {
  results?: {
    utterances?: DeepgramUtterance[]
    channels?: {
      alternatives?: {
        words?: DeepgramWord[]
      }[]
    }[]
  }
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function audioContextFromDeepgram(data: DeepgramResponse): RunAudioContext {
  const utterances = data.results?.utterances ?? []
  const fallbackWords =
    data.results?.channels?.flatMap((channel) =>
      channel.alternatives?.flatMap((alternative) => alternative.words ?? []) ?? []
    ) ?? []
  const speechSegments = utterances.length
    ? utterances.map((utterance) => ({
        start: numberOrZero(utterance.start) * 1000,
        end: numberOrZero(utterance.end) * 1000,
        confidence: clamp(numberOrZero(utterance.confidence)),
      }))
    : fallbackWords.map((word) => ({
        start: numberOrZero(word.start) * 1000,
        end: numberOrZero(word.end) * 1000,
        confidence: clamp(numberOrZero(word.confidence)),
      }))
  const silenceWindows = speechSegments
    .slice(1)
    .map((segment, index) => {
      const previous = speechSegments[index]
      const start = previous.end
      const end = segment.start

      return {
        start,
        end,
        duration: Math.max(0, end - start),
      }
    })
    .filter((window) => window.duration >= 650)
  const duration = Math.max(1, speechSegments[speechSegments.length - 1]?.end ?? 0)
  const pacing = speechSegments.length / (duration / 60_000)
  const interruptionCount = silenceWindows.filter((window) => window.duration <= 1_200).length
  const escalation = clamp(interruptionCount / Math.max(1, speechSegments.length / 3))

  return {
    id: createRunId(),
    source: "deepgram",
    speechSegments,
    silenceWindows,
    pacing,
    interruptionCount,
    escalation,
    generatedAt: Date.now(),
  }
}

