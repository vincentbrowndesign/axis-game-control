import type {
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision"
import { extractPoseFrame } from "./extractPoseLandmarks"
import type { PoseFrame, PoseProviderOptions } from "./types"

const DEFAULT_WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
const DEFAULT_MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

export class MediaPipePoseProvider {
  private landmarker: PoseLandmarker

  private constructor(landmarker: PoseLandmarker) {
    this.landmarker = landmarker
  }

  static async create(options: PoseProviderOptions = {}) {
    const { FilesetResolver, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    )
    const vision = await FilesetResolver.forVisionTasks(
      options.wasmBaseUrl || DEFAULT_WASM_BASE_URL
    )
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          options.modelAssetPath || DEFAULT_MODEL_ASSET_PATH,
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    })

    return new MediaPipePoseProvider(landmarker)
  }

  detect(video: HTMLVideoElement, timestampMs: number): PoseFrame | null {
    const result = this.landmarker.detectForVideo(video, timestampMs)
    const landmarks = (result.landmarks[0] || []) as NormalizedLandmark[]

    return extractPoseFrame({
      timestamp: video.currentTime,
      landmarks,
    })
  }

  close() {
    this.landmarker.close()
  }
}
