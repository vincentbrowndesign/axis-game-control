import type {
  AudioSignalSample,
  FrameSignalSample,
} from "@/lib/signals/types"
import type {
  CadenceEstimate,
  Segment,
  SegmentedMemory,
} from "./types"

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

function nearbyAudioEnergy(
  timestamp: number,
  audioSamples: AudioSignalSample[]
) {
  const nearby = audioSamples
    .filter((sample) => Math.abs(sample.timestamp - timestamp) <= 0.18)
    .map((sample) => sample.energy)

  return average(nearby) || 0
}

function detectPeaks({
  frameSamples,
  audioSamples,
}: {
  frameSamples: FrameSignalSample[]
  audioSamples: AudioSignalSample[]
}) {
  const peaks: FrameSignalSample[] = []

  for (let index = 1; index < frameSamples.length - 1; index += 1) {
    const previous = frameSamples[index - 1]
    const current = frameSamples[index]
    const next = frameSamples[index + 1]
    const audioEnergy = nearbyAudioEnergy(current.timestamp, audioSamples)
    const motionPeak =
      current.motionIntensity >= 0.12 &&
      current.motionIntensity >= previous.motionIntensity &&
      current.motionIntensity >= next.motionIntensity
    const audioPeak = audioEnergy >= 0.24

    if (motionPeak || audioPeak) {
      const lastPeak = peaks[peaks.length - 1]

      if (!lastPeak || current.timestamp - lastPeak.timestamp >= 0.28) {
        peaks.push(current)
      }
    }
  }

  return peaks
}

function buildCadence(peaks: FrameSignalSample[]): CadenceEstimate {
  if (peaks.length < 3) {
    return {
      intervalSeconds: null,
      cyclesPerMinute: null,
      consistency: null,
      state: "waiting",
    }
  }

  const intervals = peaks
    .slice(1)
    .map((peak, index) => peak.timestamp - peaks[index].timestamp)
    .filter((interval) => interval >= 0.28 && interval <= 1.4)
  const intervalSeconds = average(intervals)

  if (intervalSeconds == null) {
    return {
      intervalSeconds: null,
      cyclesPerMinute: null,
      consistency: null,
      state: "waiting",
    }
  }

  const consistency = clamp01(1 - standardDeviation(intervals) / 0.42)

  return {
    intervalSeconds,
    cyclesPerMinute: 60 / intervalSeconds,
    consistency,
    state: consistency >= 0.58 ? "stable" : "uneven",
  }
}

function buildActivityWindows(
  frameSamples: FrameSignalSample[]
): Segment[] {
  const windows: Segment[] = []
  let windowStart: FrameSignalSample | null = null
  let lastActive: FrameSignalSample | null = null

  for (const sample of frameSamples) {
    if (sample.motionIntensity >= 0.1) {
      windowStart ||= sample
      lastActive = sample
      continue
    }

    if (
      windowStart &&
      lastActive &&
      lastActive.timestamp - windowStart.timestamp >= 0.8
    ) {
      windows.push({
        id: `activity-${windows.length + 1}`,
        type: "activity_window",
        startTime: windowStart.timestamp,
        endTime: lastActive.timestamp,
        confidence: 0.64,
        label: "ACTIVITY WINDOW",
      })
    }

    windowStart = null
    lastActive = null
  }

  if (
    windowStart &&
    lastActive &&
    lastActive.timestamp - windowStart.timestamp >= 0.8
  ) {
    windows.push({
      id: `activity-${windows.length + 1}`,
      type: "activity_window",
      startTime: windowStart.timestamp,
      endTime: lastActive.timestamp,
      confidence: 0.64,
      label: "ACTIVITY WINDOW",
    })
  }

  return windows
}

function buildPauseSegments(windows: Segment[]) {
  const pauses: Segment[] = []

  for (let index = 1; index < windows.length; index += 1) {
    const previous = windows[index - 1]
    const current = windows[index]
    const gap = current.startTime - previous.endTime

    if (gap >= 1) {
      pauses.push({
        id: `pause-${pauses.length + 1}`,
        type: "pause",
        startTime: previous.endTime,
        endTime: current.startTime,
        confidence: 0.58,
        label: "PAUSE",
      })
    }
  }

  return pauses
}

export function segmentHandleMission({
  missionId,
  clipDuration,
  frameSamples,
  audioSamples,
}: {
  missionId: string
  clipDuration: number
  frameSamples: FrameSignalSample[]
  audioSamples: AudioSignalSample[]
}): SegmentedMemory {
  const peaks = detectPeaks({ frameSamples, audioSamples })
  const cadenceEstimate = buildCadence(peaks)
  const cycleConfidence =
    cadenceEstimate.consistency == null
      ? 0
      : 0.44 + cadenceEstimate.consistency * 0.4
  const cycles: Segment[] = peaks.slice(0, 40).map((peak, index) => ({
    id: `dribble-${index + 1}`,
    type: "dribble_cycle",
    startTime: Math.max(0, peak.timestamp - 0.16),
    endTime: Math.min(clipDuration || peak.timestamp + 0.16, peak.timestamp + 0.16),
    confidence: clamp01(cycleConfidence),
    label: "DRIBBLE RHYTHM",
  }))
  const activityWindows = buildActivityWindows(frameSamples)
  const pauses = buildPauseSegments(activityWindows)
  const segments = [...activityWindows, ...cycles, ...pauses].sort(
    (a, b) => a.startTime - b.startTime
  )
  const confidence =
    peaks.length >= 3
      ? clamp01(0.36 + (cadenceEstimate.consistency || 0) * 0.44)
      : frameSamples.length >= 6
        ? 0.28
        : 0

  return {
    missionId,
    clipDuration,
    segments,
    cadenceEstimate,
    confidence,
    summary:
      confidence >= 0.5
        ? "Cadence found."
        : "Not enough signal. Replay remains available.",
  }
}
