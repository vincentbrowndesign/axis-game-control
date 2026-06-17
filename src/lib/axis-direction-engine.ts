import type { MotionBlueprint } from "./axis-motion-blueprint";
import type { AxisPracticeDesign } from "./axis-practice-design";
import type { AxisUnderstanding } from "./axis-server";

export interface AxisDirectionOutput {
  objective: string;
  constraint: string;
  demonstration: {
    id: string;
    notice: string;
    source: "understanding";
  };
  evidenceRequired: string;
  nextAction: string;
  nextObjective: string;
}

export function directionFromDemonstration({
  understanding,
  demonstration,
  practice,
}: {
  understanding: AxisUnderstanding;
  demonstration: MotionBlueprint;
  practice: AxisPracticeDesign;
}): AxisDirectionOutput {
  const objective = objectiveFromUnderstanding(understanding, practice);
  const constraint = practice.constraint || constraintFromUnderstanding(understanding);
  const evidenceRequired =
    understanding.evidenceRequest || `Show one rep where ${demonstration.targetLabel.toLowerCase()} is visible.`;
  const nextAction = understanding.experiment || practice.goal;

  return {
    objective,
    constraint,
    demonstration: {
      id: demonstration.id,
      notice: noticeFromDemonstration(understanding, demonstration, constraint),
      source: "understanding",
    },
    evidenceRequired,
    nextAction,
    nextObjective: nextObjectiveFromUnderstanding(understanding, objective),
  };
}

function objectiveFromUnderstanding(
  understanding: AxisUnderstanding,
  practice: AxisPracticeDesign,
): string {
  if (understanding.targetPattern.label) {
    return `Make ${understanding.targetPattern.label} visible and repeatable.`;
  }

  if (understanding.focus) {
    return `Move toward ${understanding.focus}.`;
  }

  if (understanding.concept) {
    return `Clarify ${understanding.concept}.`;
  }

  return practice.goal;
}

function constraintFromUnderstanding(understanding: AxisUnderstanding): string {
  if (understanding.currentPattern.label) {
    return `Current pattern: ${understanding.currentPattern.label}.`;
  }

  if (understanding.belief) {
    return understanding.belief;
  }

  return "The limiting pattern is not visible enough yet.";
}

function noticeFromDemonstration(
  understanding: AxisUnderstanding,
  demonstration: MotionBlueprint,
  constraint: string,
): string {
  if (understanding.currentPattern.label && understanding.targetPattern.label) {
    return `Notice the shift from ${understanding.currentPattern.label} to ${understanding.targetPattern.label}.`;
  }

  if (demonstration.nowLabel !== "Now" || demonstration.targetLabel !== "Target") {
    return `Notice ${demonstration.nowLabel} against ${demonstration.targetLabel}.`;
  }

  return constraint;
}

function nextObjectiveFromUnderstanding(
  understanding: AxisUnderstanding,
  currentObjective: string,
): string {
  if (understanding.confidence < 0.7) {
    return "Collect clearer evidence before increasing the demand.";
  }

  if (understanding.targetPattern.label) {
    return `Test ${understanding.targetPattern.label} under more speed or pressure.`;
  }

  return `Validate: ${currentObjective}`;
}
