import type { AxisUnderstanding } from "./axis-server";

export interface AxisDemonstration {
  belief: string;
  confidence: number;
  currentPattern: string;
  targetPattern: string;
  nextExperiment: string;
  optionalEvidence: string;
}

export function demonstrationFromUnderstanding(understanding: AxisUnderstanding): AxisDemonstration {
  return {
    belief: understanding.belief,
    confidence: understanding.confidence,
    currentPattern: understanding.currentPattern.label || understanding.currentPattern.relationships[0] || "",
    targetPattern: understanding.targetPattern.label || understanding.targetPattern.relationships[0] || "",
    nextExperiment: understanding.experiment,
    optionalEvidence: understanding.evidenceRequest,
  };
}
