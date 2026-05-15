import type {
  AudioSignalSample,
  FrameSignalSample,
} from "@/lib/signals/types"
import { segmentHandleMission } from "./segmentHandleMission"
import type { Segment, SegmentedMemory } from "./types"

function activitySegments({
  missionId,
  clipDuration,
  frameSamples,
  burstLabel,
}: {
  missionId: string
  clipDuration: number
  frameSamples: FrameSignalSample[]
  burstLabel: string
}): SegmentedMemory {
  const segments: Segment[] = []
  let activeStart: FrameSignalSample | null = null
  let lastActive: FrameSignalSample | null = null

  for (const sample of frameSamples) {
    if (sample.motionIntensity >= 0.18) {
      activeStart ||= sample
      lastActive = sample
      continue
    }

    if (
      activeStart &&
      lastActive &&
      lastActive.timestamp - activeStart.timestamp >= 0.5
    ) {
      segments.push({
        id: `segment-${segments.length + 1}`,
        type:
          lastActive.motionIntensity >= 0.34
            ? "movement_burst"
            : "activity_window",
        startTime: activeStart.timestamp,
        endTime: lastActive.timestamp,
        confidence: 0.58,
        label: burstLabel,
      })
    }

    activeStart = null
    lastActive = null
  }

  if (
    activeStart &&
    lastActive &&
    lastActive.timestamp - activeStart.timestamp >= 0.5
  ) {
    segments.push({
      id: `segment-${segments.length + 1}`,
      type: "activity_window",
      startTime: activeStart.timestamp,
      endTime: lastActive.timestamp,
      confidence: 0.58,
      label: burstLabel,
    })
  }

  return {
    missionId,
    clipDuration,
    segments,
    cadenceEstimate: {
      intervalSeconds: null,
      cyclesPerMinute: null,
      consistency: null,
      state: "waiting",
    },
    confidence: segments.length ? 0.46 : 0,
    summary: segments.length
      ? "Activity windows found."
      : "Memory stored. Read still building.",
  }
}

export function segmentCalibrationMemory({
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
  if (missionId.includes("HANDLE")) {
    return segmentHandleMission({
      missionId,
      clipDuration,
      frameSamples,
      audioSamples,
    })
  }

  if (missionId.includes("FOOTWORK")) {
    return activitySegments({
      missionId,
      clipDuration,
      frameSamples,
      burstLabel: "DIRECTION BURST",
    })
  }

  if (missionId.includes("SHOOTING FORM")) {
    return activitySegments({
      missionId,
      clipDuration,
      frameSamples,
      burstLabel: "REPEATED MOTION",
    })
  }

  if (missionId.includes("TRANSITION")) {
    return activitySegments({
      missionId,
      clipDuration,
      frameSamples,
      burstLabel: "HIGH MOVEMENT WINDOW",
    })
  }

  return activitySegments({
    missionId,
    clipDuration,
    frameSamples,
    burstLabel: "ACTIVITY WINDOW",
  })
}
