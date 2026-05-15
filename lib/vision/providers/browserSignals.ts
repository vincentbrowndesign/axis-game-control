import type { BrowserSignalInput, BrowserSignalRead } from "./types"

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

function average(values: number[]) {
  if (!values.length) return null

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0

  const mean = average(values) || 0
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length

  return Math.sqrt(variance)
}

function countChanges(values: number[], threshold: number) {
  let changes = 0

  for (let index = 1; index < values.length; index += 1) {
    if (Math.abs(values[index] - values[index - 1]) >= threshold) {
      changes += 1
    }
  }

  return changes
}

function maxPositiveDelta(values: number[]) {
  let max = 0

  for (let index = 1; index < values.length; index += 1) {
    max = Math.max(max, values[index] - values[index - 1])
  }

  return values.length > 1 ? clamp01(max) : null
}

function repeatedMotionScore(values: number[]) {
  if (values.length < 8) return null

  const peaks: number[] = []

  for (let index = 1; index < values.length - 1; index += 1) {
    if (
      values[index] > 0.14 &&
      values[index] >= values[index - 1] &&
      values[index] >= values[index + 1]
    ) {
      peaks.push(index)
    }
  }

  if (peaks.length < 3) return 0

  const gaps = peaks
    .slice(1)
    .map((peak, index) => peak - peaks[index])
  const consistency = 1 - standardDeviation(gaps) / 6

  return clamp01(consistency)
}

export function buildBrowserSignalRead({
  duration,
  frameSamples,
  audioSamples,
}: BrowserSignalInput): BrowserSignalRead {
  const motionValues = frameSamples.map((sample) => sample.motionIntensity)
  const cameraValues = frameSamples.map((sample) => sample.cameraMovement)
  const brightnessValues = frameSamples.map((sample) => sample.brightness)
  const audioValues = audioSamples.map((sample) => sample.energy)
  const motionDelta = average(motionValues)
  const cameraMovement = average(cameraValues)
  const averageBrightness = average(brightnessValues)
  const audioEnergy = average(audioValues)
  const cameraStability =
    cameraMovement == null ? null : clamp01(1 - cameraMovement)
  const framingConsistency =
    cameraValues.length < 2
      ? null
      : clamp01(1 - standardDeviation(cameraValues) * 4)
  const activeFrames = motionValues.filter((value) => value >= 0.16).length
  const motionDensity =
    motionValues.length > 0 ? activeFrames / motionValues.length : null
  const paceChanges = countChanges(motionValues, 0.18)
  const directionChanges = countChanges(cameraValues, 0.2)
  const movementBursts = motionValues.filter((value) => value >= 0.34).length
  const repeatedMotion = repeatedMotionScore(motionValues)
  const accelerationBurst = maxPositiveDelta(motionValues)

  return {
    provider: "browserSignals",
    duration,
    frameSampleCount: frameSamples.length,
    averageBrightness,
    motionDelta,
    cameraMovement,
    cameraStability,
    framingConsistency,
    motionDensity,
    paceChanges,
    directionChanges,
    movementBursts,
    repeatedMotion,
    accelerationBurst,
    audioEnergy,
    audioAvailable: audioSamples.length > 0,
    observations: [
      {
        timestamp: frameSamples.at(-1)?.timestamp || 0,
        signal: "motion delta",
        confidence: motionDelta == null ? 0 : 0.72,
        evidence:
          motionDelta == null
            ? "No frame samples recorded."
            : `${Math.round(clamp01(motionDelta) * 100)}% motion`,
      },
      {
        timestamp: frameSamples.at(-1)?.timestamp || 0,
        signal: "camera stability",
        confidence: cameraStability == null ? 0 : 0.68,
        evidence:
          cameraStability == null
            ? "No camera samples recorded."
            : `${Math.round(cameraStability * 100)}% stable`,
      },
    ],
  }
}
