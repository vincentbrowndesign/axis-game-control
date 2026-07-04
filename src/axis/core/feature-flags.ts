export type AxisFeatureFlagKey =
  // Active — Axis A1.2
  | "camera"
  | "playerLock"
  | "openCommandToolbar"
  | "localEvidence"
  // Inactive — future capability path
  | "movementChains"
  | "clips"
  | "memoryPages"
  | "aiAgent"
  | "ballDetection"
  | "rimCalibration"
  | "huggingFaceObjects"
  | "supabaseMemory"
  | "proofClipExport"
  // Existing granular capabilities (not part of the A1.2 checklist, kept
  // because capability-registry.ts still gates real, already-shipped reads)
  | "sessionMemory"
  | "mediapipePose"
  | "localBiomechanics"
  | "proofExportPng"
  | "askAxisMemory"
  | "roboflow";

export const axisFeatureFlags: Record<AxisFeatureFlagKey, boolean> = {
  // Active — Axis A1.2
  camera: true,
  playerLock: true,
  openCommandToolbar: true,
  localEvidence: true,

  // Inactive — future capability path
  movementChains: false,
  clips: false,
  memoryPages: false,
  aiAgent: false,
  ballDetection: false,
  rimCalibration: false,
  huggingFaceObjects: false,
  supabaseMemory: false,
  proofClipExport: false,

  // Existing granular capabilities
  sessionMemory: true,
  mediapipePose: true,
  localBiomechanics: false,
  proofExportPng: false,
  askAxisMemory: false,
  roboflow: false,
};

export function isAxisFeatureEnabled(flag: AxisFeatureFlagKey) {
  return axisFeatureFlags[flag] === true;
}
