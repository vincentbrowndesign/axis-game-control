import type { Run } from "@/lib/run/runState"
import { deriveBehavioralState, type BehavioralState } from "./behavioralState"
import { detectTemporalMoments, type TemporalMoment } from "./momentDetection"
import { analyzeSequence, type SequenceAnalysis } from "./sequenceAnalysis"

export type TemporalEngineResult = {
  analysis: SequenceAnalysis
  state: BehavioralState
  moments: TemporalMoment[]
  generatedAt: number
}

export function runTemporalEngine(run: Run, now = Date.now()): TemporalEngineResult {
  const analysis = analyzeSequence(run, now)
  const state = deriveBehavioralState(run, analysis)
  const moments = detectTemporalMoments(run, analysis)

  return {
    analysis,
    state,
    moments,
    generatedAt: now,
  }
}
