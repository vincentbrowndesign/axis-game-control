import type { Run } from "@/lib/run/runState"
import { elapsedRunMs } from "@/lib/run/runState"
import { isNegativeSignal, isPositiveSignal, type SignalSide, type SignalStat } from "@/lib/run/signals"
import { scoreFor } from "@/lib/run/score"

export type AssistedEventSuggestion = {
  id: string
  side: SignalSide
  result: "plus" | "minus"
  stat: SignalStat
  label: string
  reason: string
  confidence: number
  source: "time" | "audio" | "sequence" | "camera"
}

function otherSide(side: SignalSide): SignalSide {
  return side === "home" ? "away" : "home"
}

function sideName(run: Run, side: SignalSide) {
  return side === "home" ? run.home : run.away
}

function clampConfidence(value: number) {
  return Math.max(0.32, Math.min(0.88, value))
}

function recentAudioEscalation(run: Run, elapsedMs: number) {
  const audio = run.audioContext
  if (!audio) return 0

  const elapsedSeconds = elapsedMs / 1000
  const recentSpeech = audio.speechSegments.some(
    (segment) => elapsedSeconds >= segment.start && elapsedSeconds - segment.end <= 4
  )
  const recentSilence = audio.silenceWindows.some(
    (window) => elapsedSeconds >= window.start && elapsedSeconds <= window.end + 2
  )
  const base = audio.escalation + audio.interruptionCount * 0.04

  return Math.max(0, Math.min(1, base + (recentSpeech ? 0.18 : 0) - (recentSilence ? 0.12 : 0)))
}

function buildSuggestion({
  run,
  side,
  result,
  stat,
  reason,
  confidence,
  source,
}: {
  run: Run
  side: SignalSide
  result: "plus" | "minus"
  stat: SignalStat
  reason: string
  confidence: number
  source: AssistedEventSuggestion["source"]
}): AssistedEventSuggestion {
  return {
    id: `${side}-${result}-${stat}-${run.signals.length}`,
    side,
    result,
    stat,
    label: `Possible ${stat}`,
    reason,
    confidence: clampConfidence(confidence),
    source,
  }
}

export function suggestAssistedEvents(run: Run, now = Date.now()): AssistedEventSuggestion[] {
  const elapsedMs = elapsedRunMs(run, now)
  const last = run.signals[run.signals.length - 1]
  const recent = run.signals.filter((signal) => elapsedMs - signal.time <= 18_000)
  const suggestions: AssistedEventSuggestion[] = []

  if (!last || elapsedMs < 3500) return suggestions

  const silenceMs = Math.max(0, elapsedMs - last.time)
  const audioEscalation = recentAudioEscalation(run, elapsedMs)
  const score = scoreFor(run)
  const trailingSide: SignalSide = score.home <= score.away ? "home" : "away"
  const recentSameSide = recent.filter((signal) => signal.side === last.side)
  const recentPositive = recentSameSide.filter((signal) => isPositiveSignal(signal.result)).length
  const recentNegative = recentSameSide.filter((signal) => isNegativeSignal(signal.result)).length
  const lastOwner = sideName(run, last.side)

  if (last.stat === "MISS" && silenceMs >= 1200 && silenceMs <= 6500) {
    suggestions.push(
      buildSuggestion({
        run,
        side: last.side,
        result: "plus",
        stat: "REB",
        reason: `${lastOwner} miss needs a board check.`,
        confidence: 0.58 + audioEscalation * 0.16,
        source: audioEscalation > 0.3 ? "audio" : "sequence",
      })
    )
  }

  if (recentPositive >= 2 && silenceMs >= 2500 && audioEscalation >= 0.32) {
    suggestions.push(
      buildSuggestion({
        run,
        side: last.side,
        result: "plus",
        stat: "PTS",
        reason: `${lastOwner} pressure is still rising.`,
        confidence: 0.52 + audioEscalation * 0.25,
        source: "audio",
      })
    )
  }

  if (recentNegative >= 2 && silenceMs >= 2200) {
    suggestions.push(
      buildSuggestion({
        run,
        side: last.side,
        result: "minus",
        stat: "TO",
        reason: `${lastOwner} rhythm is getting loose.`,
        confidence: 0.5 + Math.min(0.2, silenceMs / 30_000),
        source: "sequence",
      })
    )
  }

  if (silenceMs >= 10_000 && audioEscalation < 0.28) {
    suggestions.push(
      buildSuggestion({
        run,
        side: trailingSide,
        result: "minus",
        stat: "MISS",
        reason: "Long silence usually means a stalled trip.",
        confidence: 0.46 + Math.min(0.22, silenceMs / 45_000),
        source: "time",
      })
    )
  }

  if (last.stat === "PTS" && silenceMs >= 1800 && silenceMs <= 7000 && audioEscalation >= 0.25) {
    suggestions.push(
      buildSuggestion({
        run,
        side: otherSide(last.side),
        result: "minus",
        stat: "MISS",
        reason: "Answer may have come rushed.",
        confidence: 0.42 + audioEscalation * 0.22,
        source: "audio",
      })
    )
  }

  return suggestions
    .filter(
      (suggestion, index, list) =>
        list.findIndex((item) => item.side === suggestion.side && item.stat === suggestion.stat) === index
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2)
}
