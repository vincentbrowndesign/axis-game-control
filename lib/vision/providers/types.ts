import type {
  AudioSignalSample,
  FrameSignalSample,
} from "@/lib/signals/types"

export type VisionProviderId =
  | "browserSignals"
  | "mediapipePoseProvider"
  | "openAiVisionProvider"
  | "onnxProvider"

export type VisionProviderStatus =
  | "enabled"
  | "disabled"

export type VisionProviderConfig = {
  id: VisionProviderId
  status: VisionProviderStatus
  label: string
}

export type FrameObservation = {
  timestamp: number
  signal: string
  confidence: number
  evidence: string
}

export type BrowserSignalRead = {
  provider: "browserSignals"
  duration: number
  frameSampleCount: number
  averageBrightness: number | null
  motionDelta: number | null
  cameraMovement: number | null
  cameraStability: number | null
  framingConsistency: number | null
  motionDensity: number | null
  paceChanges: number
  directionChanges: number
  movementBursts: number
  repeatedMotion: number | null
  accelerationBurst: number | null
  audioEnergy: number | null
  audioAvailable: boolean
  observations: FrameObservation[]
}

export type BrowserSignalInput = {
  duration: number
  frameSamples: FrameSignalSample[]
  audioSamples: AudioSignalSample[]
}

export const visionProviders: Record<
  VisionProviderId,
  VisionProviderConfig
> = {
  browserSignals: {
    id: "browserSignals",
    status: "enabled",
    label: "Browser Signals",
  },
  mediapipePoseProvider: {
    id: "mediapipePoseProvider",
    status: "enabled",
    label: "MediaPipe Pose Provider",
  },
  openAiVisionProvider: {
    id: "openAiVisionProvider",
    status: "disabled",
    label: "OpenAI Vision Provider",
  },
  onnxProvider: {
    id: "onnxProvider",
    status: "disabled",
    label: "ONNX Provider",
  },
}
