import { loadAxisPoseDetector, type AxisPoseFrame } from "../../lib/axis/axis-pose-detector";
import type { AxisEvidence } from "../core/types";
import { createAxisEvidenceId } from "../camera/camera-source";

export type AxisMediaPipePoseAdapter = {
  detect: (video: HTMLVideoElement, timestamp: number) => AxisPoseFrame | null;
};

export async function loadAxisMediaPipePoseAdapter(): Promise<AxisMediaPipePoseAdapter | null> {
  try {
    const detector = await loadAxisPoseDetector();
    return {
      detect: (video, timestamp) => detector.detect(video, timestamp),
    };
  } catch {
    return null;
  }
}

export function poseFrameToAxisEvidence(frame: AxisPoseFrame, sessionId: string): AxisEvidence {
  return {
    capabilityId: "pose.mediapipe",
    capturedAt: new Date().toISOString(),
    id: createAxisEvidenceId("axis-pose"),
    kind: "pose",
    observations: [
      { label: "landmarks", value: frame.landmarks.length, unit: "state" },
      { label: "landmark confidence", value: Math.round(frame.confidence * 100), unit: "state" },
    ],
    sessionId,
    summary: "Pose landmarks captured",
    trust: "local_computed",
  };
}
