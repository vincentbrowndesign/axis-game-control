import type { Run } from "@/lib/run/runState"
import type { RunAudioContext } from "@/lib/run/runState"
import { deriveBehavioralState, type BehavioralState } from "./behavioralState"
import { detectTemporalMoments, type TemporalMoment } from "./momentDetection"
import { analyzeSequence, type SequenceAnalysis } from "./sequenceAnalysis"
import { calculateSystemPlusMinus, type SystemPlusMinus } from "./systemPlusMinus"

export type TemporalEngineResult = {
  analysis: SequenceAnalysis
  state: BehavioralState
  moments: TemporalMoment[]
  system: SystemPlusMinus
  audioContext?: RunAudioContext
  generatedAt: number
}

export function runTemporalEngine(run: Run, now = Date.now()): TemporalEngineResult {
  const analysis = analyzeSequence(run, now)
  const system = calculateSystemPlusMinus(run)
  const state = deriveBehavioralState(run, analysis)
  const moments = detectTemporalMoments(run, analysis)

  return {
    analysis,
    state,
    moments,
    system,
    audioContext: run.audioContext,
    generatedAt: now,
  }
}
