import {
  filterAxisMovementPrimitives,
  hasAxisMovementPrimitive,
  type AxisMovementPrimitive,
} from "./axis-movement-language";
import type { AxisPattern, AxisUnderstanding } from "./axis-server";

export type MotionBlueprintObjectKind = "player" | "ball" | "target" | "center_of_mass" | "plant_foot";

export interface MotionBlueprintPoint {
  x: number;
  y: number;
}

export interface MotionBlueprintObject {
  id: string;
  kind: MotionBlueprintObjectKind;
  now: MotionBlueprintPoint;
  target: MotionBlueprintPoint;
  radius: number;
}

export interface MotionBlueprintPath {
  id: string;
  objectId: string;
  d: string;
  primitive: AxisMovementPrimitive;
}

export interface MotionBlueprint {
  id: string;
  concept: string;
  durationMs: number;
  primitives: AxisMovementPrimitive[];
  nowLabel: string;
  targetLabel: string;
  objects: MotionBlueprintObject[];
  paths: MotionBlueprintPath[];
}

const EMPTY_PATTERN: AxisPattern = { label: "", objects: [], relationships: [], motion: [] };

export function motionBlueprintFromUnderstanding(
  understanding: Pick<
    AxisUnderstanding,
    "concept" | "primitives" | "currentPattern" | "targetPattern"
  > & { id?: string },
): MotionBlueprint {
  const primitives = ensureBlueprintPrimitives(understanding.primitives);
  const currentPattern = understanding.currentPattern ?? EMPTY_PATTERN;
  const targetPattern = understanding.targetPattern ?? EMPTY_PATTERN;
  const movement = movementVectorFor(primitives, currentPattern, targetPattern);
  const playerNow = { x: 76, y: 116 };
  const playerTarget = shift(playerNow, movement.playerDx, movement.playerDy);
  const ballNow = { x: 130, y: hasAxisMovementPrimitive(primitives, "ball_path") ? 104 : 92 };
  const ballTarget = shift(ballNow, movement.ballDx, movement.ballDy);
  const centerNow = hasAxisMovementPrimitive(primitives, "center_of_mass")
    ? shift(playerNow, hasAxisMovementPrimitive(primitives, "balance") ? 18 : 0, -4)
    : shift(playerNow, 0, -4);
  const centerTarget = shift(playerTarget, 0, -10);
  const plantNow = shift(playerNow, -18, 54);
  const plantTarget = hasAxisMovementPrimitive(primitives, "plant_foot")
    ? shift(playerTarget, movement.playerDx > 0 ? 18 : -18, 52)
    : plantNow;

  const objects: MotionBlueprintObject[] = [
    { id: "player", kind: "player", now: playerNow, target: playerTarget, radius: 15 },
    { id: "ball", kind: "ball", now: ballNow, target: ballTarget, radius: 7 },
    { id: "target", kind: "target", now: { x: 172, y: 70 }, target: { x: 172, y: 70 }, radius: 11 },
    { id: "center", kind: "center_of_mass", now: centerNow, target: centerTarget, radius: 5 },
    { id: "plant", kind: "plant_foot", now: plantNow, target: plantTarget, radius: 5 },
  ];

  return {
    id: understanding.id || "understanding-motion",
    concept: understanding.concept || "movement",
    durationMs: durationFor(primitives),
    primitives,
    nowLabel: currentPattern.label || "Now",
    targetLabel: targetPattern.label || "Target",
    objects,
    paths: buildPaths(primitives, objects),
  };
}

function ensureBlueprintPrimitives(values: unknown[]): AxisMovementPrimitive[] {
  const primitives = filterAxisMovementPrimitives(values);
  return primitives.length ? primitives : ["position", "direction"];
}

function movementVectorFor(
  primitives: AxisMovementPrimitive[],
  currentPattern: AxisPattern,
  targetPattern: AxisPattern,
) {
  const text = [
    currentPattern.label,
    targetPattern.label,
    ...currentPattern.motion,
    ...targetPattern.motion,
    ...currentPattern.relationships,
    ...targetPattern.relationships,
  ]
    .join(" ")
    .toLowerCase();

  const horizontal = text.includes("left") ? -1 : 1;
  const forward = text.includes("back") || text.includes("down") ? 1 : -1;
  const distance = hasAxisMovementPrimitive(primitives, "distance") ? 48 : 30;
  const timingBoost = hasAxisMovementPrimitive(primitives, "timing") ? 10 : 0;
  const ballDistance = hasAxisMovementPrimitive(primitives, "ball_path") ? 58 : 24;

  return {
    playerDx: horizontal * (hasAxisMovementPrimitive(primitives, "advantage") ? distance : distance * 0.55),
    playerDy: forward * (hasAxisMovementPrimitive(primitives, "balance") ? 10 : 18),
    ballDx: horizontal * ballDistance,
    ballDy: forward * (26 + timingBoost),
  };
}

function buildPaths(
  primitives: AxisMovementPrimitive[],
  objects: MotionBlueprintObject[],
): MotionBlueprintPath[] {
  const player = objectById(objects, "player");
  const ball = objectById(objects, "ball");
  const center = objectById(objects, "center");
  const plant = objectById(objects, "plant");

  return [
    ...(hasAxisMovementPrimitive(primitives, "direction") || hasAxisMovementPrimitive(primitives, "distance")
      ? [pathFor("player-path", player, "direction" as const)]
      : []),
    ...(hasAxisMovementPrimitive(primitives, "ball_path")
      ? [pathFor("ball-path", ball, "ball_path" as const)]
      : []),
    ...(hasAxisMovementPrimitive(primitives, "center_of_mass") || hasAxisMovementPrimitive(primitives, "balance")
      ? [pathFor("center-path", center, "center_of_mass" as const)]
      : []),
    ...(hasAxisMovementPrimitive(primitives, "plant_foot")
      ? [pathFor("plant-path", plant, "plant_foot" as const)]
      : []),
  ];
}

function pathFor(
  id: string,
  object: MotionBlueprintObject,
  primitive: AxisMovementPrimitive,
): MotionBlueprintPath {
  const cx = (object.now.x + object.target.x) / 2;
  const cy = Math.min(object.now.y, object.target.y) - 22;
  return {
    id,
    objectId: object.id,
    primitive,
    d: `M${object.now.x} ${object.now.y} Q${cx} ${cy} ${object.target.x} ${object.target.y}`,
  };
}

function objectById(objects: MotionBlueprintObject[], id: string): MotionBlueprintObject {
  return objects.find((object) => object.id === id) ?? objects[0];
}

function shift(point: MotionBlueprintPoint, dx: number, dy: number): MotionBlueprintPoint {
  return { x: point.x + dx, y: point.y + dy };
}

function durationFor(primitives: AxisMovementPrimitive[]): number {
  if (hasAxisMovementPrimitive(primitives, "acceleration")) return 900;
  if (hasAxisMovementPrimitive(primitives, "deceleration")) return 1500;
  if (hasAxisMovementPrimitive(primitives, "timing")) return 1200;
  return 1100;
}
