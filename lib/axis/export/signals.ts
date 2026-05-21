import { machineObservationsFromMemory, observationConfidence } from "@/lib/axis/perception/machineObservations"
import type { AxisContextPackage } from "@/lib/axis/contextPackage"
import type { AxisMemoryObject } from "@/lib/axis/types"

export type AxisExportTiming =
  | "halftime"
  | "quarter_end"
  | "postgame"
  | "pressure_swing"
  | "coach_request"
  | "replay_review"

export type AxisExportSignalName =
  | "recurrence_frequency"
  | "pressure_escalation"
  | "continuity_shift"
  | "replay_gravity"
  | "emotional_spike"
  | "repeated_breakdown"
  | "transition_burst"
  | "dead_ball_reset"
  | "machine_confidence"
  | "human_confirmed_shorthand"

export type AxisExportSignal = {
  name: AxisExportSignalName
  score: number
  evidence: string[]
}

export type AxisExportSignalStack = {
  timing: AxisExportTiming
  gravity: number
  shouldExport: boolean
  reason: string
  signals: AxisExportSignal[]
}

const EXPORT_THRESHOLDS: Record<AxisExportTiming, number> = {
  halftime: 0.48,
  quarter_end: 0.46,
  postgame: 0.42,
  pressure_swing: 0.38,
  coach_request: 0.34,
  replay_review: 0.36,
}

export function computeExportSignalStack(
  context: AxisContextPackage,
  timing: AxisExportTiming = "coach_request",
): AxisExportSignalStack {
  const memories = context.recentMemory.lastEvents
  const signals = [
    recurrenceFrequency(memories),
    pressureEscalation(context, memories),
    continuityShift(context),
    replayGravity(memories),
    emotionalSpike(memories),
    repeatedBreakdown(memories),
    transitionBurst(memories),
    deadBallReset(memories),
    machineConfidence(memories),
    humanConfirmedShorthand(memories),
  ]
  const gravity = clamp(round(signals.reduce((total, signal) => total + signal.score, 0) / signals.length))
  const threshold = EXPORT_THRESHOLDS[timing]
  const shouldExport = gravity >= threshold
  const strongest = [...signals].sort((a, b) => b.score - a.score)[0]

  return {
    timing,
    gravity,
    shouldExport,
    reason: shouldExport ? strongest.evidence[0] ?? strongest.name : "no high-gravity memory yet",
    signals,
  }
}

function recurrenceFrequency(memories: AxisMemoryObject[]): AxisExportSignal {
  const counts = tagCounts(memories)
  const repeated = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([tag, count]) => `${tag} repeated ${count}`)

  return signal("recurrence_frequency", repeated.length ? Math.min(1, repeated.length * 0.22 + 0.24) : 0.08, repeated)
}

function pressureEscalation(context: AxisContextPackage, memories: AxisMemoryObject[]): AxisExportSignal {
  const pressureMemories = memories.filter((memory) =>
    hasAny(memory, ["pressure", "turnover", "stop"]) || /\btrap|pressure|sped up|collapse\b/i.test(memory.label),
  )
  const evidence = pressureMemories.map((memory) => memory.label).slice(0, 3)
  const continuityPressure = context.continuityState.pressureShift ? 0.22 : 0

  return signal("pressure_escalation", Math.min(1, pressureMemories.length * 0.18 + continuityPressure), evidence)
}

function continuityShift(context: AxisContextPackage): AxisExportSignal {
  const evidence = [
    context.continuityState.pressureShift,
    context.continuityState.collapseWindow,
    context.continuityState.stabilizationMoment,
  ].filter(Boolean) as string[]

  return signal("continuity_shift", evidence.length ? Math.min(1, evidence.length * 0.24 + 0.18) : 0.06, evidence)
}

function replayGravity(memories: AxisMemoryObject[]): AxisExportSignal {
  const replayMemories = memories.filter((memory) => memory.replayAnchor)
  return signal("replay_gravity", Math.min(1, replayMemories.length * 0.2), replayMemories.map((memory) => memory.label).slice(0, 4))
}

function emotionalSpike(memories: AxisMemoryObject[]): AxisExportSignal {
  const spikes = memories.filter((memory) =>
    hasAny(memory, ["run", "scoring", "turnover", "replay"]) || /\bcorner 3|easy rim|and-1|cash|run\b/i.test(memory.label),
  )
  return signal("emotional_spike", Math.min(1, spikes.length * 0.16 + (spikes.length >= 2 ? 0.12 : 0)), spikes.map((memory) => memory.label).slice(0, 4))
}

function repeatedBreakdown(memories: AxisMemoryObject[]): AxisExportSignal {
  const breakdowns = memories.filter((memory) => /\bweak[- ]side|late help|no help|bad switch|collapse|close[- ]?out\b/i.test(memory.label))
  return signal("repeated_breakdown", Math.min(1, breakdowns.length * 0.25), breakdowns.map((memory) => memory.label).slice(0, 4))
}

function transitionBurst(memories: AxisMemoryObject[]): AxisExportSignal {
  const transition = memories.filter((memory) =>
    hasAny(memory, ["turnover", "rebound", "stop"]) || /\bpush|outlet|transition|early\b/i.test(memory.label),
  )
  return signal("transition_burst", Math.min(1, transition.length * 0.18), transition.map((memory) => memory.label).slice(0, 4))
}

function deadBallReset(memories: AxisMemoryObject[]): AxisExportSignal {
  const deadBall = memories.filter((memory) => /\bdead ball|timeout|reset|and-1|early foul\b/i.test(memory.label))
  return signal("dead_ball_reset", Math.min(1, deadBall.length * 0.32), deadBall.map((memory) => memory.label).slice(0, 3))
}

function machineConfidence(memories: AxisMemoryObject[]): AxisExportSignal {
  const observations = memories.flatMap((memory) => machineObservationsFromMemory(memory))
  const confident = observations.filter((item) => observationConfidence(item.confidence) !== "low")
  return signal("machine_confidence", Math.min(1, confident.length * 0.2), confident.map((item) => item.label).slice(0, 4))
}

function humanConfirmedShorthand(memories: AxisMemoryObject[]): AxisExportSignal {
  const shorthand = memories.filter((memory) => /\b->|late help|bad switch|weak side|push after|downhill|dead ball\b/i.test(memory.label))
  return signal("human_confirmed_shorthand", Math.min(1, shorthand.length * 0.18 + 0.08), shorthand.map((memory) => memory.label).slice(0, 4))
}

function signal(name: AxisExportSignalName, score: number, evidence: string[]): AxisExportSignal {
  return {
    name,
    score: clamp(round(score)),
    evidence,
  }
}

function tagCounts(memories: AxisMemoryObject[]) {
  const counts = new Map<string, number>()
  for (const memory of memories) {
    for (const tag of memory.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return counts
}

function hasAny(memory: AxisMemoryObject, tags: string[]) {
  return tags.some((tag) => memory.tags.includes(tag))
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
