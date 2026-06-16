import { hasAxisMovementPrimitive } from "./axis-movement-language";
import type { AxisUnderstanding } from "./axis-server";

export interface AxisPracticeDesign {
  constraint: string;
  goal: string;
  reps: number;
  successCondition: string;
}

export function practiceDesignFromUnderstanding(
  understanding: AxisUnderstanding,
): AxisPracticeDesign {
  const reps = repsForUnderstanding(understanding);
  const focus = understanding.focus || understanding.concept || "the current skill";
  const target = understanding.targetPattern.label || focus;

  return {
    constraint: constraintForUnderstanding(understanding),
    goal: `Make ${target} repeatable.`,
    reps,
    successCondition: successConditionForUnderstanding(understanding, reps),
  };
}

function repsForUnderstanding(understanding: AxisUnderstanding): number {
  if (understanding.confidence < 0.6) return 6;
  if (hasAxisMovementPrimitive(understanding.primitives, "timing")) return 8;
  return 10;
}

function constraintForUnderstanding(understanding: AxisUnderstanding): string {
  const text = [
    understanding.concept,
    understanding.focus,
    understanding.belief,
    understanding.currentPattern.label,
    understanding.targetPattern.label,
    ...understanding.currentPattern.motion,
    ...understanding.targetPattern.motion,
  ]
    .join(" ")
    .toLowerCase();

  if (hasAxisMovementPrimitive(understanding.primitives, "ball_path")) {
    return "Keep the ball inside the same visual lane.";
  }

  if (hasAxisMovementPrimitive(understanding.primitives, "timing")) {
    return "Start each rep on the same cue.";
  }

  if (hasAxisMovementPrimitive(understanding.primitives, "balance")) {
    return "Finish each rep without drifting off line.";
  }

  if (text.includes("defender") || hasAxisMovementPrimitive(understanding.primitives, "advantage")) {
    return "Create the advantage before attacking.";
  }

  if (hasAxisMovementPrimitive(understanding.primitives, "plant_foot")) {
    return "Keep the plant foot connected to the target line.";
  }

  return "Repeat one clean version before adding speed.";
}

function successConditionForUnderstanding(
  understanding: AxisUnderstanding,
  reps: number,
): string {
  const clean = Math.max(1, Math.ceil(reps * 0.8));

  if (hasAxisMovementPrimitive(understanding.primitives, "ball_path")) {
    return `${clean}/${reps} clean paths.`;
  }

  if (hasAxisMovementPrimitive(understanding.primitives, "timing")) {
    return `${clean}/${reps} reps on time.`;
  }

  if (hasAxisMovementPrimitive(understanding.primitives, "balance")) {
    return `${clean}/${reps} balanced finishes.`;
  }

  return `${clean}/${reps} reps match the target pattern.`;
}
