export type AxisTestCategory = "jump" | "landing" | "lateral" | "sprint" | "decel" | "shooting";

export type AxisTest = {
  id: string;
  name: string;
  category: AxisTestCategory;
  requiredLandmarks: string[];
  optionalLandmarks: string[];
  measurements: string[];
  minConfidence: number;
};

export const axisCategoryLabels: Record<AxisTestCategory, string> = {
  jump: "Jump",
  landing: "Landing",
  lateral: "Lateral",
  sprint: "Sprint",
  decel: "Decel",
  shooting: "Shooting",
};

export const axisTests: AxisTest[] = [
  {
    id: "countermovement-jump",
    name: "Countermovement Jump",
    category: "jump",
    requiredLandmarks: ["hips", "knees", "ankles", "shoulders"],
    optionalLandmarks: ["toes", "heels", "wrists"],
    measurements: ["jump_height_cm", "flight_time_ms", "takeoff_velocity", "knee_bend_depth"],
    minConfidence: 0.55,
  },
  {
    id: "drop-jump",
    name: "Drop Jump",
    category: "jump",
    requiredLandmarks: ["hips", "knees", "ankles", "feet"],
    optionalLandmarks: ["shoulders", "wrists"],
    measurements: ["contact_time_ms", "reactive_strength_index", "knee_bend_at_landing"],
    minConfidence: 0.55,
  },
  {
    id: "drop-landing",
    name: "Drop Landing",
    category: "landing",
    requiredLandmarks: ["hips", "knees", "ankles", "heels", "toes"],
    optionalLandmarks: ["shoulders"],
    measurements: ["knee_bend_at_contact", "hip_drop_depth", "landing_symmetry", "stabilization_time_ms"],
    minConfidence: 0.60,
  },
  {
    id: "single-leg-landing",
    name: "Single Leg Landing",
    category: "landing",
    requiredLandmarks: ["hips", "knees", "ankles", "feet"],
    optionalLandmarks: ["shoulders", "arms"],
    measurements: ["knee_valgus_angle", "trunk_lean", "stabilization_time_ms"],
    minConfidence: 0.60,
  },
  {
    id: "lateral-shuffle",
    name: "Lateral Shuffle",
    category: "lateral",
    requiredLandmarks: ["hips", "knees", "ankles", "shoulders"],
    optionalLandmarks: ["feet", "wrists"],
    measurements: ["step_rate", "lateral_velocity", "center_of_mass_range", "stance_width"],
    minConfidence: 0.50,
  },
  {
    id: "lateral-bound",
    name: "Lateral Bound",
    category: "lateral",
    requiredLandmarks: ["hips", "knees", "ankles", "feet", "shoulders"],
    optionalLandmarks: ["wrists"],
    measurements: ["bound_distance_cm", "contact_time_ms", "symmetry"],
    minConfidence: 0.55,
  },
  {
    id: "10-yard-sprint",
    name: "10-Yard Sprint",
    category: "sprint",
    requiredLandmarks: ["hips", "knees", "ankles", "feet", "shoulders"],
    optionalLandmarks: ["arms"],
    measurements: ["split_time_ms", "stride_length", "step_frequency", "hip_drive"],
    minConfidence: 0.45,
  },
  {
    id: "deceleration-stop",
    name: "Deceleration Stop",
    category: "decel",
    requiredLandmarks: ["hips", "knees", "ankles", "feet"],
    optionalLandmarks: ["shoulders", "arms"],
    measurements: ["braking_steps", "knee_bend_depth", "stopping_distance_cm", "trunk_lean_at_stop"],
    minConfidence: 0.55,
  },
  {
    id: "jump-shot",
    name: "Jump Shot Release",
    category: "shooting",
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips", "knees", "ankles"],
    optionalLandmarks: ["ball"],
    measurements: ["release_angle", "elbow_position_at_release", "shot_arc", "knee_bend_at_release"],
    minConfidence: 0.60,
  },
  {
    id: "free-throw",
    name: "Free Throw",
    category: "shooting",
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips", "knees"],
    optionalLandmarks: ["ball", "ankles"],
    measurements: ["release_angle", "elbow_alignment", "knee_bend_contribution"],
    minConfidence: 0.65,
  },
];

export function getTestsByCategory(category: AxisTestCategory) {
  return axisTests.filter((t) => t.category === category);
}

export function getTestById(id: string) {
  return axisTests.find((t) => t.id === id) ?? null;
}
