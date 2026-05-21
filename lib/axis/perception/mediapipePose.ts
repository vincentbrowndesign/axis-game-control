"use client"

import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision"

export type AxisPoseLandmark = {
  x: number
  y: number
  z?: number
  visibility?: number
}

export type AxisPoseFrame = {
  landmarks: AxisPoseLandmark[]
  timestampMs: number
}

export const AXIS_POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
]

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
const EMA_ALPHA = 0.34

let sharedLandmarker: Promise<PoseLandmarker> | null = null

export class AxisMediapipePoseTracker {
  private previous: AxisPoseLandmark[] | null = null

  private constructor(private readonly landmarker: PoseLandmarker) {}

  static async create() {
    const landmarker = await getPoseLandmarker()
    return new AxisMediapipePoseTracker(landmarker)
  }

  detect(video: HTMLVideoElement, timestampMs = performance.now()): AxisPoseFrame | null {
    if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null
    }

    const result = this.landmarker.detectForVideo(video, timestampMs)
    const raw = result.landmarks[0]
    if (!raw?.length) return null

    const landmarks = smoothLandmarks(toAxisLandmarks(raw), this.previous)
    this.previous = landmarks

    return {
      landmarks,
      timestampMs,
    }
  }

  reset() {
    this.previous = null
  }
}

async function getPoseLandmarker() {
  sharedLandmarker ??= createPoseLandmarker()
  return sharedLandmarker
}

async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  })
}

function toAxisLandmarks(landmarks: NormalizedLandmark[]): AxisPoseLandmark[] {
  return landmarks.map((landmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
  }))
}

function smoothLandmarks(current: AxisPoseLandmark[], previous: AxisPoseLandmark[] | null) {
  if (!previous || previous.length !== current.length) return current

  return current.map((landmark, index) => {
    const last = previous[index]
    return {
      x: ema(landmark.x, last.x),
      y: ema(landmark.y, last.y),
      z: landmark.z === undefined || last.z === undefined ? landmark.z : ema(landmark.z, last.z),
      visibility: landmark.visibility,
    }
  })
}

function ema(value: number, previous: number) {
  return previous + (value - previous) * EMA_ALPHA
}
