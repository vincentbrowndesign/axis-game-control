import type { CalibrationBaseline } from "@/lib/calibration/types"
import type { ExtractedReplaySignals } from "@/lib/signals/types"
import type { ReplaySessionView } from "@/types/memory"
import type { BasketballSignalLabel, BasketballSignalState } from "./types"

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function hasPlayer(session: ReplaySessionView) {
  return Boolean(
    session.player &&
      session.player.trim() &&
      session.player !== "Unassigned"
  )
}

function clipType(
  session: ReplaySessionView,
  signals?: ExtractedReplaySignals | null
): BasketballSignalLabel {
  const duration = signals?.duration || session.duration || 0

  if (!duration) return "REPLAY READY"
  if (duration < 10) return "SHORT CLIP"

  return session.mission && session.mission !== "None"
    ? "WARMUP ADDED"
    : "MEMORY STORED"
}

function activityState(
  signals?: ExtractedReplaySignals | null
): BasketballSignalLabel {
  if (!signals?.frameSampleCount) return "LOW ACTIVITY"
  if (signals.activityState === "active") return "ACTIVE MOTION"

  return "LOW ACTIVITY"
}

function cameraState(
  signals?: ExtractedReplaySignals | null
): BasketballSignalLabel {
  if (signals?.cameraMovement == null) return "CAMERA STABLE"
  if (signals.cameraMovement >= 0.18) return "CAMERA MOVING"

  return "CAMERA STABLE"
}

export function readBasketballSignal({
  session,
  signals,
  baseline,
}: {
  session: ReplaySessionView
  signals?: ExtractedReplaySignals | null
  baseline?: CalibrationBaseline | null
}): BasketballSignalState {
  const clip = clipType(session, signals)
  const activity = activityState(signals)
  const camera = cameraState(signals)
  const evidence: string[] = []

  if (signals?.duration || session.duration) {
    evidence.push(
      `Duration ${Math.round(signals?.duration || session.duration || 0)}s`
    )
  }

  if (signals?.frameSampleCount) {
    evidence.push(`${signals.frameSampleCount} frame samples`)
  }

  if (signals?.motionIntensity != null) {
    evidence.push(`Motion ${percent(signals.motionIntensity)}`)
  }

  if (signals?.cameraMovement != null) {
    evidence.push(`Camera ${percent(signals.cameraMovement)}`)
  }

  if (signals?.audioEnergy != null) {
    evidence.push(`Audio ${percent(signals.audioEnergy)}`)
  }

  if (baseline) {
    evidence.push(`${baseline.memoryCount} warmups`)
  }

  if (!hasPlayer(session)) {
    evidence.push("Player not assigned")
  }

  const headline =
    session.mission && session.mission !== "None"
      ? "WARMUP ADDED"
      : clip === "SHORT CLIP"
        ? "MEMORY STORED"
        : clip

  return {
    headline,
    courtState: camera,
    activityState: activity,
    clipType: clip,
    evidence,
    confidence: Math.min(
      0.92,
      0.35 +
        (signals?.frameSampleCount ? 0.25 : 0) +
        (signals?.motionIntensity != null ? 0.15 : 0) +
        (signals?.cameraMovement != null ? 0.1 : 0) +
        (signals?.audioEnergy != null ? 0.07 : 0)
    ),
  }
}
