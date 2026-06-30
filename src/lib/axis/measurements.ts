export type AxisMeasurementId =
  | "jump_height_cm"
  | "flight_time_ms"
  | "takeoff_velocity"
  | "knee_bend_depth"
  | "knee_bend_at_contact"
  | "knee_bend_at_release"
  | "knee_bend_at_landing"
  | "knee_valgus_angle"
  | "hip_drop_depth"
  | "landing_symmetry"
  | "stabilization_time_ms"
  | "contact_time_ms"
  | "reactive_strength_index"
  | "step_rate"
  | "lateral_velocity"
  | "center_of_mass_range"
  | "stance_width"
  | "bound_distance_cm"
  | "symmetry"
  | "split_time_ms"
  | "stride_length"
  | "step_frequency"
  | "hip_drive"
  | "braking_steps"
  | "stopping_distance_cm"
  | "trunk_lean_at_stop"
  | "trunk_lean"
  | "release_angle"
  | "elbow_position_at_release"
  | "elbow_alignment"
  | "shot_arc"
  | "knee_bend_contribution";

export type AxisMeasurementUnit = "cm" | "ms" | "deg" | "ratio" | "count" | "m/s" | "steps";

export type AxisMeasurement = {
  id: AxisMeasurementId | string;
  label: string;
  unit: AxisMeasurementUnit;
  value: number | null;
  baseline: number | null;
  delta: number | null;
};

export const axisMeasurementMeta: Record<string, { label: string; unit: AxisMeasurementUnit }> = {
  jump_height_cm: { label: "Jump Height", unit: "cm" },
  flight_time_ms: { label: "Flight Time", unit: "ms" },
  takeoff_velocity: { label: "Takeoff Velocity", unit: "m/s" },
  knee_bend_depth: { label: "Knee Bend Depth", unit: "deg" },
  knee_bend_at_contact: { label: "Knee Bend at Contact", unit: "deg" },
  knee_bend_at_release: { label: "Knee Bend at Release", unit: "deg" },
  knee_bend_at_landing: { label: "Knee Bend at Landing", unit: "deg" },
  knee_valgus_angle: { label: "Knee Valgus", unit: "deg" },
  knee_bend_contribution: { label: "Knee Bend Contribution", unit: "deg" },
  hip_drop_depth: { label: "Hip Drop Depth", unit: "cm" },
  landing_symmetry: { label: "Landing Symmetry", unit: "ratio" },
  stabilization_time_ms: { label: "Stabilization Time", unit: "ms" },
  contact_time_ms: { label: "Contact Time", unit: "ms" },
  reactive_strength_index: { label: "Reactive Strength Index", unit: "ratio" },
  step_rate: { label: "Step Rate", unit: "steps" },
  lateral_velocity: { label: "Lateral Velocity", unit: "m/s" },
  center_of_mass_range: { label: "Center of Mass Range", unit: "cm" },
  stance_width: { label: "Stance Width", unit: "cm" },
  bound_distance_cm: { label: "Bound Distance", unit: "cm" },
  symmetry: { label: "Symmetry", unit: "ratio" },
  split_time_ms: { label: "Split Time", unit: "ms" },
  stride_length: { label: "Stride Length", unit: "cm" },
  step_frequency: { label: "Step Frequency", unit: "steps" },
  hip_drive: { label: "Hip Drive", unit: "deg" },
  braking_steps: { label: "Braking Steps", unit: "steps" },
  stopping_distance_cm: { label: "Stopping Distance", unit: "cm" },
  trunk_lean_at_stop: { label: "Trunk Lean at Stop", unit: "deg" },
  trunk_lean: { label: "Trunk Lean", unit: "deg" },
  release_angle: { label: "Release Angle", unit: "deg" },
  elbow_position_at_release: { label: "Elbow at Release", unit: "deg" },
  elbow_alignment: { label: "Elbow Alignment", unit: "deg" },
  shot_arc: { label: "Shot Arc", unit: "deg" },
};

export function buildMeasurements(
  ids: string[],
  values: Record<string, number | null> = {},
  baselines: Record<string, number | null> = {},
): AxisMeasurement[] {
  return ids.map((id) => {
    const meta = axisMeasurementMeta[id] ?? { label: id, unit: "ratio" as AxisMeasurementUnit };
    const value = values[id] ?? null;
    const baseline = baselines[id] ?? null;
    const delta = value !== null && baseline !== null ? value - baseline : null;
    return { id, label: meta.label, unit: meta.unit, value, baseline, delta };
  });
}

export function formatMeasurement(value: number | null, unit: AxisMeasurementUnit) {
  if (value === null) return "—";
  if (unit === "cm") return `${value.toFixed(1)} cm`;
  if (unit === "ms") return `${Math.round(value)} ms`;
  if (unit === "deg") return `${value.toFixed(1)}°`;
  if (unit === "m/s") return `${value.toFixed(2)} m/s`;
  if (unit === "ratio") return value.toFixed(2);
  if (unit === "steps") return `${Math.round(value)}`;
  return String(value);
}
