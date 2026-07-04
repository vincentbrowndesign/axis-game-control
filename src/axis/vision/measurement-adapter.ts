import type { AxisPoseFrame, AxisPoseLandmark } from "../../lib/axis/axis-pose-detector";
import type { AxisEvidence, AxisObservation } from "../core/types";
import { createAxisEvidenceId } from "../camera/camera-source";

export type AxisLocalMeasurement = {
  id: "knee_angle" | "hip_angle" | "trunk_lean" | "balance" | "landmark_confidence";
  label: string;
  value: number;
  unit: "deg" | "ratio" | "state";
};

export function measureAxisPose(frame: AxisPoseFrame | null): AxisLocalMeasurement[] {
  if (!frame) return [];

  return [
    angleMeasurement("knee_angle", "Knee angle", [
      jointAngle(point(frame, "left_hip"), point(frame, "left_knee"), point(frame, "left_ankle")),
      jointAngle(point(frame, "right_hip"), point(frame, "right_knee"), point(frame, "right_ankle")),
    ]),
    angleMeasurement("hip_angle", "Hip angle", [
      jointAngle(point(frame, "left_shoulder"), point(frame, "left_hip"), point(frame, "left_knee")),
      jointAngle(point(frame, "right_shoulder"), point(frame, "right_hip"), point(frame, "right_knee")),
    ]),
    numericMeasurement("trunk_lean", "Trunk lean", lineAngle(point(frame, "left_shoulder"), point(frame, "left_hip")), "deg"),
    numericMeasurement("balance", "Balance", balanceRatio(frame), "ratio"),
    numericMeasurement("landmark_confidence", "Landmark confidence", frame.confidence, "state"),
  ].filter((measurement): measurement is AxisLocalMeasurement => Boolean(measurement));
}

export function measurementsToAxisEvidence(measurements: AxisLocalMeasurement[], sessionId: string): AxisEvidence | null {
  if (!measurements.length) return null;

  return {
    capabilityId: "measurement.local",
    capturedAt: new Date().toISOString(),
    id: createAxisEvidenceId("axis-measurement"),
    kind: "measurement",
    observations: measurements.map((measurement): AxisObservation => ({
      label: measurement.label,
      unit: measurement.unit,
      value: measurement.unit === "state" ? Math.round(measurement.value * 100) : Math.round(measurement.value),
    })),
    sessionId,
    summary: "Local measurements captured",
    trust: "local_computed",
  };
}

function angleMeasurement(
  id: AxisLocalMeasurement["id"],
  label: string,
  values: Array<number | null>,
): AxisLocalMeasurement | null {
  const usable = values.filter((value): value is number => value !== null);
  if (!usable.length) return null;
  return {
    id,
    label,
    unit: "deg",
    value: usable.reduce((sum, value) => sum + value, 0) / usable.length,
  };
}

function numericMeasurement(
  id: AxisLocalMeasurement["id"],
  label: string,
  value: number | null,
  unit: AxisLocalMeasurement["unit"],
): AxisLocalMeasurement | null {
  if (value === null || !Number.isFinite(value)) return null;
  return { id, label, unit, value };
}

function point(frame: AxisPoseFrame, name: string) {
  return frame.landmarks.find((landmark) => landmark.name === name) ?? null;
}

function jointAngle(a: AxisPoseLandmark | null, b: AxisPoseLandmark | null, c: AxisPoseLandmark | null) {
  if (!visible(a) || !visible(b) || !visible(c)) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  return Math.abs(Math.atan2(ab.x * cb.y - ab.y * cb.x, ab.x * cb.x + ab.y * cb.y) * (180 / Math.PI));
}

function lineAngle(a: AxisPoseLandmark | null, b: AxisPoseLandmark | null) {
  if (!visible(a) || !visible(b)) return null;
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

function balanceRatio(frame: AxisPoseFrame) {
  const leftAnkle = point(frame, "left_ankle");
  const rightAnkle = point(frame, "right_ankle");
  const leftHip = point(frame, "left_hip");
  const rightHip = point(frame, "right_hip");
  if (!visible(leftAnkle) || !visible(rightAnkle) || !visible(leftHip) || !visible(rightHip)) return null;
  const footMid = (leftAnkle.x + rightAnkle.x) / 2;
  const hipMid = (leftHip.x + rightHip.x) / 2;
  return Math.max(0, 1 - Math.abs(footMid - hipMid) * 4);
}

function visible(landmark: AxisPoseLandmark | null): landmark is AxisPoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 0.75) > 0.25);
}
