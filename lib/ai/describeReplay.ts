import type { CalibrationBaseline } from "@/lib/calibration/types"
import type { ExtractedReplaySignals } from "@/lib/signals/types"

export type FrameObservation = {
  timestamp: number
  signal: string
  confidence: number
  evidence: string
}

export type ReplayDescription = {
  summary: string
  observations: FrameObservation[]
}

function confidenceFromEvidence(value: number | null) {
  if (value == null) return 0.35

  return Math.max(0.35, Math.min(0.9, value))
}

export function describeReplay({
  signals,
  baseline,
}: {
  signals: ExtractedReplaySignals
  baseline: CalibrationBaseline
}): ReplayDescription {
  const descriptions: string[] = []

  if (signals.duration > 0 && signals.duration < 10) {
    descriptions.push("The clip contains a short memory.")
  }

  if (signals.activityState === "low") {
    descriptions.push("Motion activity is low in this clip.")
  } else if (signals.activityState === "active") {
    descriptions.push("Motion activity is present in this clip.")
  }

  if (signals.brightnessShifts > 0) {
    descriptions.push("Brightness changes during the session.")
  }

  if (baseline.memoryCount <= 1) {
    descriptions.push("Warmups build toward comparison.")
  } else {
    descriptions.push("This replay is now part of the player archive.")
  }

  return {
    summary:
      descriptions[0] ||
      "Memory stored. Read still building.",
    observations: signals.timeline.map((segment) => ({
      timestamp: segment.start,
      signal: segment.label,
      confidence: confidenceFromEvidence(
        signals.motionIntensity ?? signals.audioEnergy
      ),
      evidence: segment.evidence,
    })),
  }
}
