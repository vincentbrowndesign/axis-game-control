import type {
  AudioSignalSample,
  ExtractedReplaySignals,
  FrameSignalSample,
  SignalAccumulator,
  SignalTimelineSegment,
} from "./types"

const MAX_FRAME_SAMPLES = 120
const MAX_AUDIO_SAMPLES = 120

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

function average(values: number[]) {
  if (!values.length) return null

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function segmentEvidence(value: number) {
  return `${Math.round(clamp01(value) * 100)}%`
}

export function createSignalAccumulator(
  duration = 0
): SignalAccumulator {
  return {
    duration: Number.isFinite(duration) ? Math.max(duration, 0) : 0,
    frameSamples: [],
    audioSamples: [],
  }
}

export function setSignalDuration(
  accumulator: SignalAccumulator,
  duration: number
) {
  if (Number.isFinite(duration) && duration > 0) {
    accumulator.duration = duration
  }
}

export function readFrameSignalSample({
  data,
  previousFrame,
  timestamp,
}: {
  data: Uint8ClampedArray
  previousFrame: Uint8ClampedArray | null
  timestamp: number
}): FrameSignalSample {
  let brightness = 0
  let motion = 0
  let cameraShift = 0
  const pixelCount = data.length / 4

  for (let index = 0; index < data.length; index += 4) {
    const luminance =
      data[index] * 0.299 +
      data[index + 1] * 0.587 +
      data[index + 2] * 0.114

    brightness += luminance

    if (previousFrame) {
      const previousLuminance =
        previousFrame[index] * 0.299 +
        previousFrame[index + 1] * 0.587 +
        previousFrame[index + 2] * 0.114
      const delta = Math.abs(luminance - previousLuminance)

      motion += delta
      if (delta > 32) cameraShift += 1
    }
  }

  const normalizedBrightness = clamp01(brightness / pixelCount / 255)
  const motionIntensity = previousFrame
    ? clamp01(motion / pixelCount / 42)
    : 0

  return {
    timestamp,
    brightness: normalizedBrightness,
    brightnessShift: previousFrame ? motionIntensity : 0,
    motionIntensity,
    cameraMovement: previousFrame
      ? clamp01(cameraShift / pixelCount / 0.38)
      : 0,
  }
}

export function addFrameSignalSample(
  accumulator: SignalAccumulator,
  sample: FrameSignalSample
) {
  accumulator.frameSamples = [
    ...accumulator.frameSamples,
    sample,
  ].slice(-MAX_FRAME_SAMPLES)
}

export function addAudioSignalSample(
  accumulator: SignalAccumulator,
  sample: AudioSignalSample
) {
  accumulator.audioSamples = [
    ...accumulator.audioSamples,
    {
      timestamp: sample.timestamp,
      energy: clamp01(sample.energy),
    },
  ].slice(-MAX_AUDIO_SAMPLES)
}

function buildTimeline(
  frameSamples: FrameSignalSample[],
  audioSamples: AudioSignalSample[]
) {
  const segments: SignalTimelineSegment[] = []

  for (const sample of frameSamples) {
    if (sample.motionIntensity >= 0.28) {
      segments.push({
        start: sample.timestamp,
        end: sample.timestamp,
        label: "ACTIVE MOTION",
        evidence: `Motion ${segmentEvidence(sample.motionIntensity)}`,
      })
    } else if (sample.motionIntensity > 0 && sample.motionIntensity <= 0.08) {
      segments.push({
        start: sample.timestamp,
        end: sample.timestamp,
        label: "LOW ACTIVITY",
        evidence: `Motion ${segmentEvidence(sample.motionIntensity)}`,
      })
    }

    if (sample.brightnessShift >= 0.28) {
      segments.push({
        start: sample.timestamp,
        end: sample.timestamp,
        label: "BRIGHTNESS SHIFT",
        evidence: `Shift ${segmentEvidence(sample.brightnessShift)}`,
      })
    }
  }

  for (const sample of audioSamples) {
    if (sample.energy >= 0.32) {
      segments.push({
        start: sample.timestamp,
        end: sample.timestamp,
        label: "AUDIO ENERGY",
        evidence: `Audio ${segmentEvidence(sample.energy)}`,
      })
    }
  }

  return segments
    .sort((a, b) => a.start - b.start)
    .filter((segment, index, all) => {
      const previous = all[index - 1]

      return (
        !previous ||
        previous.label !== segment.label ||
        Math.abs(previous.start - segment.start) > 4
      )
    })
    .slice(-8)
}

export function extractSignals(
  accumulator: SignalAccumulator
): ExtractedReplaySignals {
  const frameSamples = accumulator.frameSamples
  const audioSamples = accumulator.audioSamples
  const motionIntensity = average(
    frameSamples.map((sample) => sample.motionIntensity)
  )
  const cameraMovement = average(
    frameSamples.map((sample) => sample.cameraMovement)
  )
  const averageBrightness = average(
    frameSamples.map((sample) => sample.brightness)
  )
  const audioEnergy = average(
    audioSamples.map((sample) => sample.energy)
  )
  const brightnessShifts = frameSamples.filter(
    (sample) => sample.brightnessShift >= 0.28
  ).length

  return {
    duration: accumulator.duration,
    frameSampleCount: frameSamples.length,
    averageBrightness,
    brightnessShifts,
    motionIntensity,
    cameraMovement,
    activityState:
      motionIntensity == null
        ? "unknown"
        : motionIntensity >= 0.16
          ? "active"
          : "low",
    audioEnergy,
    audioState:
      audioEnergy == null
        ? "unknown"
        : audioEnergy >= 0.18
          ? "noisy"
          : "silent",
    timeline: buildTimeline(frameSamples, audioSamples),
  }
}
