export type ActivityState = "low" | "active" | "unknown"

export type AudioState = "silent" | "noisy" | "unknown"

export type FrameSignalSample = {
  timestamp: number
  brightness: number
  brightnessShift: number
  motionIntensity: number
  cameraMovement: number
}

export type AudioSignalSample = {
  timestamp: number
  energy: number
}

export type SignalTimelineSegment = {
  start: number
  end: number
  label: "LOW ACTIVITY" | "ACTIVE MOTION" | "BRIGHTNESS SHIFT" | "AUDIO ENERGY"
  evidence: string
}

export type ExtractedReplaySignals = {
  duration: number
  frameSampleCount: number
  averageBrightness: number | null
  brightnessShifts: number
  motionIntensity: number | null
  cameraMovement: number | null
  activityState: ActivityState
  audioEnergy: number | null
  audioState: AudioState
  timeline: SignalTimelineSegment[]
}

export type SignalAccumulator = {
  duration: number
  frameSamples: FrameSignalSample[]
  audioSamples: AudioSignalSample[]
}
