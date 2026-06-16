export const AXIS_MOVEMENT_PRIMITIVES = [
  "position",
  "direction",
  "distance",
  "timing",
  "balance",
  "force",
  "acceleration",
  "deceleration",
  "orientation",
  "advantage",
  "ball_path",
  "center_of_mass",
  "plant_foot",
] as const;

export type AxisMovementPrimitive = (typeof AXIS_MOVEMENT_PRIMITIVES)[number];

export const AXIS_MOVEMENT_PRIMITIVE_SET = new Set<string>(AXIS_MOVEMENT_PRIMITIVES);

export const AXIS_MOVEMENT_PRIMITIVE_LABELS: Record<AxisMovementPrimitive, string> = {
  position: "Position",
  direction: "Direction",
  distance: "Distance",
  timing: "Timing",
  balance: "Balance",
  force: "Force",
  acceleration: "Acceleration",
  deceleration: "Deceleration",
  orientation: "Orientation",
  advantage: "Advantage",
  ball_path: "Ball Path",
  center_of_mass: "Center Of Mass",
  plant_foot: "Plant Foot",
};

export const AXIS_MOVEMENT_PRIMITIVE_TEXT = AXIS_MOVEMENT_PRIMITIVES.join(", ");
export const AXIS_MOVEMENT_PRIMITIVE_JSON_TEXT = AXIS_MOVEMENT_PRIMITIVES
  .map((primitive) => `"${primitive}"`)
  .join(", ");

export function isAxisMovementPrimitive(value: unknown): value is AxisMovementPrimitive {
  return typeof value === "string" && AXIS_MOVEMENT_PRIMITIVE_SET.has(value);
}

export function filterAxisMovementPrimitives(values: unknown[]): AxisMovementPrimitive[] {
  return values.filter(isAxisMovementPrimitive);
}

export function hasAxisMovementPrimitive(
  primitives: readonly AxisMovementPrimitive[],
  primitive: AxisMovementPrimitive,
): boolean {
  return primitives.includes(primitive);
}
