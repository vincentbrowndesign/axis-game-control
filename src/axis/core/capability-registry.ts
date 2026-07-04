import { axisFeatureFlags } from "./feature-flags";
import type { AxisCapability } from "./types";

export const axisCapabilityRegistry: AxisCapability[] = [
  {
    id: "session-memory",
    input: ["tap", "typed", "voice", "frame", "clip", "pose", "measurement", "object_detection"],
    labVisible: false,
    mainUiVisible: true,
    name: "Session Memory",
    output: ["memory_page"],
    release: "Axis A1.0",
    status: axisFeatureFlags.sessionMemory ? "active" : "disabled",
    summary: "Turns user signals and evidence into searchable session memory.",
  },
  {
    id: "camera.browser",
    input: ["tap"],
    labVisible: false,
    mainUiVisible: true,
    name: "Camera Evidence",
    output: ["frame", "clip"],
    release: "Axis A1.1",
    status: axisFeatureFlags.camera ? "active" : "disabled",
    summary: "Captures frames or short clips without making vision mandatory.",
  },
  {
    id: "pose.mediapipe",
    input: ["frame"],
    labVisible: true,
    mainUiVisible: false,
    name: "Pose Evidence",
    output: ["pose"],
    release: "Axis A1.2",
    status: axisFeatureFlags.mediapipePose ? "active" : "disabled",
    summary: "Local pose landmarks from captured camera evidence.",
  },
  {
    id: "measurement.local",
    input: ["pose"],
    labVisible: true,
    mainUiVisible: false,
    name: "Local Biomechanics",
    output: ["measurement", "measurement"],
    release: "Axis A1.2",
    status: axisFeatureFlags.localBiomechanics ? "active" : "disabled",
    summary: "Computes only supported local measurements from pose evidence.",
  },
  {
    id: "objects.huggingface",
    input: ["frame"],
    labVisible: true,
    mainUiVisible: false,
    name: "Object Evidence",
    output: ["object_detection", "object"],
    release: "Axis A1.4",
    status: axisFeatureFlags.huggingFaceObjects ? "active" : "planned",
    summary: "Future custom object detection. Disabled in A1.2 player-lock mode.",
  },
  {
    id: "player.lock",
    input: ["frame", "pose"],
    labVisible: true,
    mainUiVisible: false,
    name: "Player Lock",
    output: ["vision_read"],
    release: "Axis A1.2",
    status: axisFeatureFlags.playerLock ? "active" : "disabled",
    summary: "Local player detection from MediaPipe pose with TensorFlow person fallback.",
  },
  {
    id: "proof.export.png",
    input: ["frame", "clip", "pose", "measurement"],
    labVisible: true,
    mainUiVisible: false,
    name: "PNG Proof Export",
    output: ["proof_frame"],
    release: "Axis A1.2",
    status: axisFeatureFlags.proofExportPng ? "active" : "disabled",
    summary: "Exports the current camera frame, pose overlay, and measurement metadata as local proof evidence.",
  },
  {
    id: "ask-axis-memory",
    input: ["typed"],
    labVisible: false,
    mainUiVisible: true,
    name: "Ask Axis",
    output: ["memory_page"],
    release: "Axis A1.6",
    status: axisFeatureFlags.askAxisMemory ? "available" : "planned",
    summary: "Searches and reasons over saved Axis memory pages.",
  },
  {
    id: "roboflow",
    input: ["frame"],
    labVisible: true,
    mainUiVisible: false,
    name: "Roboflow",
    output: ["object_detection"],
    release: "Axis A1.4",
    status: "deprecated",
    summary: "Removed from the active Axis capability path.",
  },
];

export function getAxisCapability(id: string) {
  return axisCapabilityRegistry.find((capability) => capability.id === id) ?? null;
}

export function getMainAxisCapabilities() {
  return axisCapabilityRegistry.filter((capability) => capability.mainUiVisible && capability.status !== "deprecated");
}

export function getAxisLabCapabilities() {
  return axisCapabilityRegistry.filter((capability) => capability.labVisible);
}
