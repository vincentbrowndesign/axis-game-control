export type AxisMeasureSourceType = "dataset" | "repo" | "API" | "paper" | "internal";

export type AxisMeasureTargetObject = "player" | "ball" | "rim" | "relationship" | "pose" | "tracking";

export type AxisMeasureUseTiming = "use now" | "use later";

export type AxisMeasureLicenseRisk = "low" | "medium" | "high" | "review required";

export type AxisMeasureSetupEffort = "low" | "medium" | "high";

export type AxisMeasureRegistryCategory =
  | "Player detection/tracking"
  | "Ball detection/tracking"
  | "Rim/hoop detection and manual calibration"
  | "Pose/body landmarks"
  | "Multi-object tracking"
  | "Basketball skill/video datasets"
  | "APIs/tools already available in Axis"
  | "Axis-owned training data from live sessions";

export type AxisMeasureSourceRegistryEntry = {
  id: string;
  name: string;
  category: AxisMeasureRegistryCategory;
  type: AxisMeasureSourceType;
  targetObject: AxisMeasureTargetObject;
  useTiming: AxisMeasureUseTiming;
  licenseRisk: AxisMeasureLicenseRisk;
  setupEffort: AxisMeasureSetupEffort;
  expectedProductValue: string;
  notes: string;
};

export const axisMeasureSourceRegistry = [
  {
    category: "Player detection/tracking",
    expectedProductValue: "Baseline player and ball visibility for the current Player + Ball + Rim lock system.",
    id: "yolo11-coco-person-sports-ball",
    licenseRisk: "medium",
    name: "YOLO11 / COCO person + sports ball",
    notes: "Current detector foundation. Use COCO class 0 person as player and class 32 sports ball as ball. It does not detect rim.",
    setupEffort: "low",
    targetObject: "player",
    type: "API",
    useTiming: "use now",
  },
  {
    category: "Multi-object tracking",
    expectedProductValue: "Reference material for stable player IDs in small-sided basketball footage.",
    id: "trackid3x3",
    licenseRisk: "review required",
    name: "TrackID3x3",
    notes: "Basketball-focused tracking source. Useful later for multi-player identity stability, but not needed for the current single-player default.",
    setupEffort: "medium",
    targetObject: "tracking",
    type: "dataset",
    useTiming: "use later",
  },
  {
    category: "Multi-object tracking",
    expectedProductValue: "Sports tracking benchmark for stronger player-track matching and missed-detection handling.",
    id: "sportsmot",
    licenseRisk: "review required",
    name: "SportsMOT",
    notes: "General sports MOT source. Good reference for tracking logic, occlusion, and ID stability beyond the v1 lock flow.",
    setupEffort: "medium",
    targetObject: "tracking",
    type: "dataset",
    useTiming: "use later",
  },
  {
    category: "Basketball skill/video datasets",
    expectedProductValue: "Basketball scene understanding references after Axis Measure is reliable on player, ball, and rim locks.",
    id: "deepsportlab",
    licenseRisk: "review required",
    name: "DeepSportLab",
    notes: "Treat as research/reference until source files, label schema, and license terms are reviewed.",
    setupEffort: "high",
    targetObject: "relationship",
    type: "dataset",
    useTiming: "use later",
  },
  {
    category: "Basketball skill/video datasets",
    expectedProductValue: "Potential reference for basketball broadcast-style detection and tracking workflows.",
    id: "deepsportradar",
    licenseRisk: "review required",
    name: "DeepSportradar",
    notes: "Treat as research/reference. Confirm public availability, annotations, and allowed use before any training or product dependency.",
    setupEffort: "high",
    targetObject: "relationship",
    type: "paper",
    useTiming: "use later",
  },
  {
    category: "Player detection/tracking",
    expectedProductValue: "Fast source discovery for object datasets that may improve player, ball, or gym-context detection.",
    id: "roboflow-universe-rf100",
    licenseRisk: "review required",
    name: "Roboflow Universe / RF100",
    notes: "Useful for discovery and benchmarking. Every dataset has its own terms, so license review is required before training.",
    setupEffort: "medium",
    targetObject: "player",
    type: "dataset",
    useTiming: "use later",
  },
  {
    category: "Basketball skill/video datasets",
    expectedProductValue: "Later reference for basketball skill clips once Axis Measure graduates beyond object lock.",
    id: "basket-skill-dataset",
    licenseRisk: "review required",
    name: "BASKET skill dataset",
    notes: "Useful later for skill-video organization. Not a v0 dependency because Axis Measure is not full basketball analytics yet.",
    setupEffort: "high",
    targetObject: "relationship",
    type: "dataset",
    useTiming: "use later",
  },
  {
    category: "Axis-owned training data from live sessions",
    expectedProductValue: "Best private source for real Axis gym lighting, camera angles, players, and balls.",
    id: "axis-session-camera-captures",
    licenseRisk: "low",
    name: "Axis session camera captures",
    notes: "Use only when captured with user permission and reviewed. This is the main source for product-specific sharpening.",
    setupEffort: "medium",
    targetObject: "player",
    type: "internal",
    useTiming: "use now",
  },
  {
    category: "Axis-owned training data from live sessions",
    expectedProductValue: "Ground truth for manual rim placement, rim anchor UX, and future hoop detection evaluation.",
    id: "axis-manual-rim-locks",
    licenseRisk: "low",
    name: "Axis manual rim locks",
    notes: "Current rim truth should come from manual locks, not detector claims.",
    setupEffort: "low",
    targetObject: "rim",
    type: "internal",
    useTiming: "use now",
  },
  {
    category: "Axis-owned training data from live sessions",
    expectedProductValue: "Improves box filtering by learning what users accept and reject in real gyms.",
    id: "axis-accepted-rejected-boxes",
    licenseRisk: "low",
    name: "Axis accepted/rejected boxes",
    notes: "Useful for reducing reflection/background false positives after explicit review.",
    setupEffort: "medium",
    targetObject: "tracking",
    type: "internal",
    useTiming: "use now",
  },
  {
    category: "APIs/tools already available in Axis",
    expectedProductValue: "Small repeatable frame set for regression checks before detector or overlay changes ship.",
    id: "axis-saved-test-frames",
    licenseRisk: "low",
    name: "Axis saved test frames",
    notes: "Use for smoke tests of player, ball, rim overlay behavior. Keep it small and reviewed.",
    setupEffort: "low",
    targetObject: "relationship",
    type: "internal",
    useTiming: "use now",
  },
] satisfies AxisMeasureSourceRegistryEntry[];

export function listAxisMeasureSourceRegistry(): AxisMeasureSourceRegistryEntry[] {
  return axisMeasureSourceRegistry;
}

export function listAxisMeasureSourcesByCategory(
  category: AxisMeasureRegistryCategory,
): AxisMeasureSourceRegistryEntry[] {
  return axisMeasureSourceRegistry.filter((source) => source.category === category);
}
