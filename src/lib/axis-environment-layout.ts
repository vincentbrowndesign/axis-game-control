import {
  hasAxisMovementPrimitive,
  type AxisMovementPrimitive,
} from "./axis-movement-language";
import type { AxisUnderstanding } from "./axis-server";

export interface EnvironmentPoint {
  x: number;
  y: number;
}

export interface AxisEnvironmentTarget {
  id: string;
  label: string;
  at: EnvironmentPoint;
  radius: number;
  reason: string;
}

export interface AxisEnvironmentLine {
  id: string;
  label: string;
  from: EnvironmentPoint;
  to: EnvironmentPoint;
  reason: string;
}

export interface AxisEnvironmentGate {
  id: string;
  label: string;
  left: EnvironmentPoint;
  right: EnvironmentPoint;
  width: number;
  reason: string;
}

export interface AxisEnvironmentPlatform {
  id: string;
  label: string;
  center: EnvironmentPoint;
  width: number;
  height: number;
  reason: string;
}

export interface AxisEnvironmentReactionZone {
  id: string;
  label: string;
  center: EnvironmentPoint;
  radius: number;
  trigger: string;
  reason: string;
}

export interface AxisEnvironmentLayout {
  id: string;
  name: string;
  primitives: AxisMovementPrimitive[];
  targets: AxisEnvironmentTarget[];
  lines: AxisEnvironmentLine[];
  gates: AxisEnvironmentGate[];
  platforms: AxisEnvironmentPlatform[];
  reactionZones: AxisEnvironmentReactionZone[];
}

type EnvironmentInput = Pick<
  AxisUnderstanding,
  "id" | "concept" | "focus" | "primitives" | "currentPattern" | "targetPattern" | "belief"
>;

export function environmentLayoutFromUnderstanding(
  understanding: EnvironmentInput,
): AxisEnvironmentLayout {
  const primitives = understanding.primitives.length
    ? understanding.primitives
    : (["position", "direction"] as AxisMovementPrimitive[]);
  const name = understanding.focus || understanding.concept || "movement environment";
  const text = [
    understanding.concept,
    understanding.focus,
    understanding.belief,
    understanding.currentPattern.label,
    understanding.targetPattern.label,
    ...understanding.currentPattern.relationships,
    ...understanding.targetPattern.relationships,
    ...understanding.currentPattern.motion,
    ...understanding.targetPattern.motion,
  ]
    .join(" ")
    .toLowerCase();

  return {
    id: understanding.id || "environment-layout",
    name,
    primitives,
    targets: buildTargets(primitives, text),
    lines: buildLines(primitives, text),
    gates: buildGates(primitives, text),
    platforms: buildPlatforms(primitives, text),
    reactionZones: buildReactionZones(primitives, text),
  };
}

function buildTargets(primitives: AxisMovementPrimitive[], text: string): AxisEnvironmentTarget[] {
  const targetSide = text.includes("left") ? 0.32 : 0.68;
  const targets: AxisEnvironmentTarget[] = [
    {
      id: "target-primary",
      label: "Primary Target",
      at: { x: targetSide, y: 0.28 },
      radius: 0.06,
      reason: "Gives the movement a clear destination.",
    },
  ];

  if (hasAxisMovementPrimitive(primitives, "ball_path")) {
    targets.push({
      id: "target-ball-path",
      label: "Ball Path Target",
      at: { x: 0.5, y: 0.18 },
      radius: 0.045,
      reason: "Anchors where the ball should travel.",
    });
  }

  return targets;
}

function buildLines(primitives: AxisMovementPrimitive[], text: string): AxisEnvironmentLine[] {
  const direction = text.includes("left") ? -1 : 1;
  const lines: AxisEnvironmentLine[] = [
    {
      id: "line-start",
      label: "Start Line",
      from: { x: 0.28, y: 0.72 },
      to: { x: 0.72, y: 0.72 },
      reason: "Defines the starting relationship.",
    },
  ];

  if (
    hasAxisMovementPrimitive(primitives, "direction") ||
    hasAxisMovementPrimitive(primitives, "distance")
  ) {
    lines.push({
      id: "line-attack-path",
      label: "Movement Line",
      from: { x: 0.5, y: 0.72 },
      to: { x: 0.5 + direction * 0.22, y: 0.34 },
      reason: "Makes the intended direction visible.",
    });
  }

  if (hasAxisMovementPrimitive(primitives, "orientation")) {
    lines.push({
      id: "line-shoulder",
      label: "Shoulder Line",
      from: { x: 0.38, y: 0.56 },
      to: { x: 0.62, y: 0.5 },
      reason: "Shows where the body should face.",
    });
  }

  return lines;
}

function buildGates(primitives: AxisMovementPrimitive[], text: string): AxisEnvironmentGate[] {
  const narrow = hasAxisMovementPrimitive(primitives, "balance") || text.includes("tight");
  const width = narrow ? 0.12 : 0.18;
  const gates: AxisEnvironmentGate[] = [
    {
      id: "gate-decision",
      label: "Decision Gate",
      left: { x: 0.5 - width / 2, y: 0.48 },
      right: { x: 0.5 + width / 2, y: 0.48 },
      width,
      reason: "Creates a visible opening the player must organize around.",
    },
  ];

  if (hasAxisMovementPrimitive(primitives, "advantage")) {
    gates.push({
      id: "gate-advantage",
      label: "Advantage Gate",
      left: { x: 0.64, y: 0.38 },
      right: { x: 0.78, y: 0.38 },
      width: 0.14,
      reason: "Represents the window created before the defender settles.",
    });
  }

  return gates;
}

function buildPlatforms(primitives: AxisMovementPrimitive[], text: string): AxisEnvironmentPlatform[] {
  const platform: AxisEnvironmentPlatform = {
    id: "platform-base",
    label: "Base Platform",
    center: { x: 0.5, y: 0.74 },
    width: hasAxisMovementPrimitive(primitives, "plant_foot") ? 0.18 : 0.26,
    height: 0.12,
    reason: "Defines the body base before movement starts.",
  };

  const platforms = [platform];

  if (
    hasAxisMovementPrimitive(primitives, "center_of_mass") ||
    hasAxisMovementPrimitive(primitives, "balance")
  ) {
    platforms.push({
      id: "platform-balance",
      label: "Balance Platform",
      center: { x: text.includes("forward") ? 0.55 : 0.5, y: 0.6 },
      width: 0.2,
      height: 0.1,
      reason: "Shows where the body should stay controlled.",
    });
  }

  return platforms;
}

function buildReactionZones(
  primitives: AxisMovementPrimitive[],
  text: string,
): AxisEnvironmentReactionZone[] {
  const zones: AxisEnvironmentReactionZone[] = [];

  if (
    hasAxisMovementPrimitive(primitives, "timing") ||
    hasAxisMovementPrimitive(primitives, "advantage")
  ) {
    zones.push({
      id: "zone-trigger",
      label: "Reaction Zone",
      center: { x: 0.5, y: 0.44 },
      radius: 0.13,
      trigger: text.includes("defender") ? "defender changes position" : "movement cue appears",
      reason: "Marks where the environment should force a response.",
    });
  }

  if (
    hasAxisMovementPrimitive(primitives, "acceleration") ||
    hasAxisMovementPrimitive(primitives, "deceleration")
  ) {
    zones.push({
      id: "zone-speed-change",
      label: "Speed Change Zone",
      center: { x: 0.62, y: 0.36 },
      radius: 0.1,
      trigger: hasAxisMovementPrimitive(primitives, "deceleration") ? "slow down here" : "go here",
      reason: "Places the speed change in the environment.",
    });
  }

  return zones.length
    ? zones
    : [
        {
          id: "zone-read",
          label: "Read Zone",
          center: { x: 0.5, y: 0.5 },
          radius: 0.12,
          trigger: "read the space",
          reason: "Gives the player one place to read before moving.",
        },
      ];
}
