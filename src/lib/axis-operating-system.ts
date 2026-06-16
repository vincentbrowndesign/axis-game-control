import type { AxisCvSensorInput } from "./axis-cv-observation";
import { compareEvidenceToUnderstanding } from "./axis-evidence-comparison";
import type { AxisEvidenceComparison } from "./axis-evidence-comparison";
import { environmentLayoutFromUnderstanding } from "./axis-environment-layout";
import type { AxisEnvironmentLayout } from "./axis-environment-layout";
import { renderCoachingIntervention } from "./axis-live-coach-renderer";
import type { AxisCoachingIntervention } from "./axis-live-coach-renderer";
import { motionBlueprintFromUnderstanding } from "./axis-motion-blueprint";
import type { MotionBlueprint } from "./axis-motion-blueprint";
import { updateUnderstandingFromObservations } from "./axis-observation-engine";
import type { ObservationLearningResult } from "./axis-observation-engine";
import { practiceDesignFromUnderstanding } from "./axis-practice-design";
import type { AxisPracticeDesign } from "./axis-practice-design";
import {
  observationsFromRealTimeSources,
  type AxisRealTimeOutput,
} from "./axis-real-time";
import type { AxisObservation, AxisUnderstanding } from "./axis-server";

export interface AxisOperatingSystemInput {
  understanding: AxisUnderstanding;
  voice?: string | null;
  observations?: AxisObservation[];
  observation?: AxisObservation | null;
  cv?: AxisCvSensorInput | null;
  learnFromSources?: boolean;
}

export interface AxisPracticeOutput {
  experiment: string;
  evidenceRequest: string;
  design: AxisPracticeDesign;
}

export interface AxisOperatingSystemOutput {
  sourceOfTruth: "understanding";
  understandingId: string;
  understanding: AxisUnderstanding;
  learning: ObservationLearningResult;
  sequence: {
    tellMe: string;
    showMe: MotionBlueprint;
    watchThis: string;
    tryThis: AxisPracticeOutput;
    showMeAgain: string;
  };
  demonstration: MotionBlueprint;
  practice: AxisPracticeOutput;
  environment: AxisEnvironmentLayout;
  evidence: {
    request: string;
  };
  comparison: AxisEvidenceComparison;
  coaching: AxisCoachingIntervention;
  cv: {
    observations: AxisObservation[];
  };
  realTime: AxisRealTimeOutput;
}

export function runAxisOperatingSystem(
  input: AxisOperatingSystemInput,
): AxisOperatingSystemOutput {
  const observations = [
    ...(input.observation ? [input.observation] : []),
    ...observationsFromRealTimeSources(input),
  ];
  const learning = input.learnFromSources === false
    ? {
        understanding: input.understanding,
        appliedObservationCount: 0,
        confidenceDelta: 0,
      }
    : updateUnderstandingFromObservations(input.understanding, observations);
  const understanding = learning.understanding;
  const demonstration = motionBlueprintFromUnderstanding(understanding);
  const coaching = renderCoachingIntervention(understanding);
  const practiceDesign = practiceDesignFromUnderstanding(understanding);
  const practice = {
    experiment: understanding.experiment || "Try one rep with the current focus.",
    evidenceRequest: understanding.evidenceRequest || "Show the rep again.",
    design: practiceDesign,
  };
  const comparison = compareEvidenceToUnderstanding(understanding, observations[0]);

  return {
    sourceOfTruth: "understanding",
    understandingId: understanding.id,
    understanding,
    learning,
    sequence: {
      tellMe: understanding.belief || "Tell Axis what you are working on.",
      showMe: demonstration,
      watchThis: coaching.watchFor,
      tryThis: practice,
      showMeAgain: practice.evidenceRequest,
    },
    demonstration,
    practice,
    environment: environmentLayoutFromUnderstanding(understanding),
    evidence: {
      request: practice.evidenceRequest,
    },
    comparison,
    coaching,
    cv: {
      observations,
    },
    realTime: {
      understanding,
      learning,
      intervention: coaching.sayThis,
      watchFor: coaching.watchFor,
      nextRepRule: coaching.nextRepRule,
    },
  };
}
