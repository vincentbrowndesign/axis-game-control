import type { AxisCvSensorInput } from "./axis-cv-observation";
import { observationFromCvSensor } from "./axis-cv-observation";
import { renderCoachingIntervention } from "./axis-live-coach-renderer";
import {
  updateUnderstandingFromObservations,
  type ObservationLearningResult,
} from "./axis-observation-engine";
import type { AxisObservation, AxisUnderstanding } from "./axis-server";

export interface AxisRealTimeInput {
  understanding: AxisUnderstanding;
  voice?: string | null;
  observations?: AxisObservation[];
  cv?: AxisCvSensorInput | null;
}

export interface AxisRealTimeOutput {
  understanding: AxisUnderstanding;
  learning: ObservationLearningResult;
  intervention: string;
  watchFor: string;
  nextRepRule: string;
}

export function runRealTimeAxis(input: AxisRealTimeInput): AxisRealTimeOutput {
  const observations = observationsFromRealTimeSources(input);
  const learning = updateUnderstandingFromObservations(input.understanding, observations);
  const coaching = renderCoachingIntervention(learning.understanding);

  return {
    understanding: learning.understanding,
    learning,
    intervention: coaching.sayThis,
    watchFor: coaching.watchFor,
    nextRepRule: coaching.nextRepRule,
  };
}

export function observationsFromRealTimeSources(
  input: Pick<AxisRealTimeInput, "voice" | "observations" | "cv">,
): AxisObservation[] {
  return [
    ...observationsFromVoice(input.voice),
    ...(input.observations ?? []),
    ...(input.cv ? [observationFromCvSensor(input.cv)] : []),
  ];
}

function observationsFromVoice(voice: string | null | undefined): AxisObservation[] {
  const summary = voice?.replace(/\s+/g, " ").trim();
  if (!summary) return [];

  return [
    {
      source: "voice",
      summary,
      relevantSignals: [],
      ignoredNoise: [],
      updates: {
        confidenceDelta: 0.02,
      },
    },
  ];
}
