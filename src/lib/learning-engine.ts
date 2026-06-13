import type { Verdict, WitnessEvent } from "./axis-core";

// ---------------------------------------------------------------------------
// Observation — what the athlete noticed after a rep
// Text is stored but never parsed. Presence is the signal, not content.
// ---------------------------------------------------------------------------

export interface Observation {
  experiment_id: string;
  intent_id: string;
  text: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Outcome — what the engine recommends after accumulating evidence
// ---------------------------------------------------------------------------

export type OutcomeSignal =
  | "continue"   // not enough signal yet — keep going
  | "advance"    // constraint consistently satisfied — move forward
  | "refine"     // constraint consistently violated — tighten it
  | "rest";      // athlete noticed something, partial progress — enough for now

export interface Outcome {
  experiment_id: string;
  signal: OutcomeSignal;
  confidence: number;
  basis: string;
}

// ---------------------------------------------------------------------------
// State — accumulated per experiment, not per session
// ---------------------------------------------------------------------------

const witnessLog = new Map<string, WitnessEvent[]>();
const observationLog = new Map<string, Observation[]>();

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const MIN_REPS = 3;
const ADVANCE_THRESHOLD = 0.75;
const REFINE_THRESHOLD = 0.70;

// ---------------------------------------------------------------------------
// record — called when any witness produces a claim
// ---------------------------------------------------------------------------

export function record(event: WitnessEvent): void {
  const bucket = witnessLog.get(event.experiment_id) ?? [];
  bucket.push(event);
  witnessLog.set(event.experiment_id, bucket);
}

// ---------------------------------------------------------------------------
// observe — called when the athlete reports what they noticed
// Presence signals awareness. Content is not examined.
// ---------------------------------------------------------------------------

export function observe(observation: Observation): void {
  const bucket = observationLog.get(observation.experiment_id) ?? [];
  bucket.push(observation);
  observationLog.set(observation.experiment_id, bucket);
}

// ---------------------------------------------------------------------------
// evaluate — produce an outcome from accumulated evidence
// ---------------------------------------------------------------------------

export function evaluate(experiment_id: string): Outcome {
  const reps = witnessLog.get(experiment_id) ?? [];

  if (reps.length < MIN_REPS) {
    return { experiment_id, signal: "continue", confidence: 0, basis: "not enough reps" };
  }

  const verdicts = reps.map((e): Verdict => e.claim.verdict ?? "unobservable");
  const total = verdicts.length;
  const rate = (v: Verdict) => verdicts.filter((x) => x === v).length / total;

  const satisfiedRate = rate("satisfied");
  const violatedRate = rate("violated");
  const partialRate = rate("partial");

  if (satisfiedRate >= ADVANCE_THRESHOLD) {
    return { experiment_id, signal: "advance", confidence: satisfiedRate, basis: "consistently satisfied" };
  }

  if (violatedRate >= REFINE_THRESHOLD) {
    return { experiment_id, signal: "refine", confidence: violatedRate, basis: "consistently violated" };
  }

  // Athlete noticed something + showing progress = natural stopping point
  const hasObservation = (observationLog.get(experiment_id) ?? []).length > 0;
  if (hasObservation && satisfiedRate + partialRate > 0.5) {
    return { experiment_id, signal: "rest", confidence: 0.6, basis: "progress with observation" };
  }

  return { experiment_id, signal: "continue", confidence: 0.5, basis: "mixed results" };
}

// ---------------------------------------------------------------------------
// clear — reset state for an experiment (new session)
// ---------------------------------------------------------------------------

export function clear(experiment_id: string): void {
  witnessLog.delete(experiment_id);
  observationLog.delete(experiment_id);
}
