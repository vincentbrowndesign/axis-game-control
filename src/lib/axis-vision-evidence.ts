import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

import { type AxisEvidence } from "./axis-evidence";

// Singleton — loaded once, reused across calls
let landmarkerPromise: Promise<PoseLandmarker> | null = null;

function loadLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    ).then((vision) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          delegate: "GPU",
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        },
        numPoses: 1,
        runningMode: "VIDEO",
      }),
    );
  }
  return landmarkerPromise;
}

// Head up/down from pose landmarks.
// In MediaPipe normalized coords (0=top, 1=bottom):
//   head up  → nose.y is significantly less than shoulder midpoint Y
//   head down → nose.y approaches shoulder midpoint Y (looking at ball)
function classifyHeadPosition(landmarks: Array<{ x: number; y: number; z: number }>): string | null {
  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  if (!nose || !leftShoulder || !rightShoulder) return null;

  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  return nose.y < shoulderMidY - 0.08 ? "Head Up" : "Head Down";
}

export async function createHeadPositionEvidence(
  videoElement: HTMLVideoElement,
): Promise<AxisEvidence> {
  try {
    const landmarker = await loadLandmarker();
    const result = landmarker.detectForVideo(videoElement, performance.now());
    const pose = result.landmarks[0];
    const value = pose ? classifyHeadPosition(pose) : null;
    return { kind: "OBSERVATION", source: "CAMERA", value };
  } catch {
    return { kind: "OBSERVATION", source: "CAMERA", value: null };
  }
}
