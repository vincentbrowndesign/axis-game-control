import type { PoseLandmarker } from "@mediapipe/tasks-vision";

export type AxisPoseLandmark = {
  name: string;
  index: number;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type AxisPoseFrame = {
  frameId: number;
  timestamp: number;
  landmarks: AxisPoseLandmark[];
  confidence: number;
};

export type AxisPoseDetector = {
  detect(video: HTMLVideoElement, timestamp: number): AxisPoseFrame | null;
};

const landmarkNames: Record<number, string> = {
  0: "nose",
  11: "left_shoulder",
  12: "right_shoulder",
  13: "left_elbow",
  14: "right_elbow",
  15: "left_wrist",
  16: "right_wrist",
  23: "left_hip",
  24: "right_hip",
  25: "left_knee",
  26: "right_knee",
  27: "left_ankle",
  28: "right_ankle",
  29: "left_heel",
  30: "right_heel",
  31: "left_foot_index",
  32: "right_foot_index",
};

let detectorPromise: Promise<AxisPoseDetector> | null = null;
let frameId = 0;

function mapLandmarks(
  landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>,
): AxisPoseLandmark[] {
  const mapped: AxisPoseLandmark[] = [];

  for (const [rawIndex, name] of Object.entries(landmarkNames)) {
    const index = Number(rawIndex);
    const point = landmarks[index];
    if (point) {
      mapped.push({
        index,
        name,
        visibility: point.visibility,
        x: point.x,
        y: point.y,
        z: point.z,
      });
    }
  }

  return mapped;
}

function estimateConfidence(landmarks: AxisPoseLandmark[]) {
  const needed = landmarks.filter((point) =>
    [
      "left_shoulder",
      "right_shoulder",
      "left_hip",
      "right_hip",
      "left_ankle",
      "right_ankle",
    ].includes(point.name),
  );

  if (needed.length === 0) return 0;

  const visibilityTotal = needed.reduce(
    (sum, point) => sum + (typeof point.visibility === "number" ? point.visibility : 0.75),
    0,
  );

  return Math.min(1, visibilityTotal / needed.length);
}

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

async function createDetector(): Promise<AxisPoseDetector> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const create = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { delegate, modelAssetPath: MODEL_URL },
      numPoses: 1,
      runningMode: "VIDEO",
    });

  let landmarker: PoseLandmarker;
  try {
    landmarker = await create("GPU");
  } catch {
    landmarker = await create("CPU"); // some mobile browsers reject the GPU delegate
  }

  return {
    detect(video: HTMLVideoElement, timestamp: number) {
      const result = landmarker.detectForVideo(video, timestamp);
      const pose = result.landmarks[0];
      if (!pose) return null;

      const landmarks = mapLandmarks(pose);
      return {
        confidence: estimateConfidence(landmarks),
        frameId: frameId++,
        landmarks,
        timestamp,
      };
    },
  };
}

export async function loadAxisPoseDetector(): Promise<AxisPoseDetector> {
  if (!detectorPromise) {
    const pending = createDetector();
    detectorPromise = pending;
    pending.catch(() => {
      // a failed load (offline court wifi, CDN hiccup) must not brick pose until reload
      if (detectorPromise === pending) detectorPromise = null;
    });
  }

  return detectorPromise;
}

export async function detectAxisPose(
  video: HTMLVideoElement,
  timestamp: number,
): Promise<AxisPoseFrame | null> {
  const detector = await loadAxisPoseDetector();
  return detector.detect(video, timestamp);
}
