import type { AxisPoseFrame, AxisPoseLandmark } from "../../lib/axis/axis-pose-detector";
import type { AxisDetectedObject, AxisVisionRead } from "../core/types";
import type { AxisLocalMeasurement } from "./measurement-adapter";

export type AxisOverlayInput = {
  measurements: AxisLocalMeasurement[];
  pose: AxisPoseFrame | null;
  video: HTMLVideoElement;
};

const poseLines: Array<[string, string]> = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];

export function renderAxisPoseOverlay(canvas: HTMLCanvasElement, input: AxisOverlayInput) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = input.video.videoWidth || canvas.clientWidth || 1280;
  const height = input.video.videoHeight || canvas.clientHeight || 720;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.clearRect(0, 0, width, height);
  drawFloor(context, width, height);
  drawPose(context, width, height, input.pose);
  drawMeasurementLabels(context, input.measurements);
}

export function renderAxisBasketballVisionOverlay(canvas: HTMLCanvasElement, input: {
  read: AxisVisionRead | null;
  video: HTMLVideoElement;
}) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = input.video.videoWidth;
  const height = input.video.videoHeight;
  if (!width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.clearRect(0, 0, width, height);
  if (!input.read) return;

  const player = input.read.objects.find((object) => object.label === "player");
  if (!player) return;

  if (player.box) drawPlayerBox(context, player, input.read.lockState, width, height);
  else if (player.point) drawPlayerDot(context, player, input.read.lockState, width, height);
}

function drawPlayerBox(
  context: CanvasRenderingContext2D,
  player: AxisDetectedObject,
  lockState: AxisVisionRead["lockState"],
  videoWidth: number,
  videoHeight: number,
) {
  const box = player.box;
  if (!box) return;

  const x = toPixels(box.x, videoWidth);
  const y = toPixels(box.y, videoHeight);
  const width = toPixels(box.width, videoWidth);
  const height = toPixels(box.height, videoHeight);
  const style = boxStyle(lockState);
  if (style.alpha <= 0) return;

  context.save();
  context.globalAlpha = style.alpha;
  context.strokeStyle = style.stroke;
  context.lineWidth = style.lineWidth;
  context.setLineDash(style.dash);
  context.strokeRect(x, y, width, height);
  context.setLineDash([]);
  if (lockState === "locked" || lockState === "saved") {
    drawTinyPlayerLabel(context, x, y, style.stroke);
  }
  context.restore();
}

function drawPlayerDot(
  context: CanvasRenderingContext2D,
  player: AxisDetectedObject,
  lockState: AxisVisionRead["lockState"],
  videoWidth: number,
  videoHeight: number,
) {
  if (!player.point) return;
  const style = boxStyle(lockState);
  if (style.alpha <= 0) return;

  const x = toPixels(player.point.x, videoWidth);
  const y = toPixels(player.point.y, videoHeight);
  context.save();
  context.globalAlpha = style.alpha;
  context.fillStyle = style.stroke;
  context.strokeStyle = "#101510";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawTinyPlayerLabel(context: CanvasRenderingContext2D, x: number, y: number, stroke: string) {
  context.font = "700 11px Arial, sans-serif";
  const label = "Player";
  const width = context.measureText(label).width + 12;
  context.fillStyle = "rgba(16, 21, 16, 0.82)";
  context.beginPath();
  context.roundRect(x, Math.max(6, y - 18), width, 18, 6);
  context.fill();
  context.fillStyle = stroke;
  context.fillText(label, x + 6, Math.max(18, y - 5));
}

function boxStyle(lockState: AxisVisionRead["lockState"]) {
  if (lockState === "saved") return { alpha: 1, dash: [], lineWidth: 4, stroke: "#9dff45" };
  if (lockState === "locked") return { alpha: 0.92, dash: [], lineWidth: 3, stroke: "rgba(255, 255, 255, 0.92)" };
  if (lockState === "review") return { alpha: 0.42, dash: [10, 9], lineWidth: 2, stroke: "rgba(255, 255, 255, 0.76)" };
  if (lockState === "lost") return { alpha: 0.2, dash: [8, 10], lineWidth: 2, stroke: "rgba(255, 255, 255, 0.58)" };
  return { alpha: 0, dash: [], lineWidth: 0, stroke: "transparent" };
}

function toPixels(value: number, dimension: number) {
  return value <= 1 ? value * dimension : value;
}

function drawFloor(context: CanvasRenderingContext2D, width: number, height: number) {
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(width * 0.08, height * 0.82);
  context.lineTo(width * 0.92, height * 0.82);
  context.stroke();
}

function drawPose(context: CanvasRenderingContext2D, width: number, height: number, pose: AxisPoseFrame | null) {
  if (!pose) return;
  const landmarks = new Map(pose.landmarks.map((landmark) => [landmark.name, landmark]));

  context.lineWidth = 3;
  context.strokeStyle = "rgba(41, 138, 82, 0.88)";
  poseLines.forEach(([from, to]) => {
    const a = landmarks.get(from);
    const b = landmarks.get(to);
    if (!visible(a) || !visible(b)) return;
    context.beginPath();
    context.moveTo(a.x * width, a.y * height);
    context.lineTo(b.x * width, b.y * height);
    context.stroke();
  });

  pose.landmarks.forEach((landmark) => {
    if (!visible(landmark)) return;
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#16783d";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(landmark.x * width, landmark.y * height, 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });
}

function drawMeasurementLabels(context: CanvasRenderingContext2D, measurements: AxisLocalMeasurement[]) {
  context.font = "700 13px Arial, sans-serif";
  measurements.slice(0, 3).forEach((measurement, index) => {
    const text = `${measurement.label}: ${Math.round(measurement.value)}${measurement.unit === "deg" ? " deg" : ""}`;
    const width = context.measureText(text).width + 14;
    const y = 26 + index * 28;
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.fillRect(14, y - 18, width, 23);
    context.fillStyle = "#101510";
    context.fillText(text, 21, y);
  });
}

function visible(landmark: AxisPoseLandmark | undefined): landmark is AxisPoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 0.75) > 0.25);
}
