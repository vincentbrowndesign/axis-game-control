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

export async function loadAxisPoseDetector(): Promise<AxisPoseDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      const landmarker: PoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          delegate: "GPU",
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        },
        numPoses: 1,
        runningMode: "VIDEO",
      });

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
    })();
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
