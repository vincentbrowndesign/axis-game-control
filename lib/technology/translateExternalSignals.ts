import type {
  ExternalCameraSignal,
} from "@/lib/integrations/cameras"
import type { SmartBallSignal } from "@/lib/integrations/smartBall"
import type {
  AxisSignalAttachment,
  ExternalSignalEnvelope,
} from "@/lib/integrations/types"
import type { WearableSignal } from "@/lib/integrations/wearables"

export type AxisExternalSignalKind =
  | "physiology"
  | "camera"
  | "ball"
  | "geometry"

export type AxisTranslatedSignal = {
  kind: AxisExternalSignalKind
  attachment: AxisSignalAttachment
  label: string
  memoryLine: string
  evidence: string[]
  confidence: number
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

export function translateWearableSignal(
  envelope: ExternalSignalEnvelope<WearableSignal>
): AxisTranslatedSignal {
  const signal = envelope.signal
  const evidence = [
    signal.heartRate != null ? `Heart rate ${signal.heartRate}` : null,
    signal.acceleration != null
      ? `Acceleration ${signal.acceleration}`
      : null,
    signal.load != null ? `Load ${signal.load}` : null,
    signal.recovery != null ? `Recovery ${signal.recovery}` : null,
  ].filter((item): item is string => Boolean(item))

  return {
    kind: "physiology",
    attachment: envelope.attachment,
    label: "WEARABLE SIGNAL READY",
    memoryLine: "Physiology attached to memory.",
    evidence,
    confidence: evidence.length ? 0.7 : 0.35,
  }
}

export function translateCameraSignal(
  envelope: ExternalSignalEnvelope<ExternalCameraSignal>
): AxisTranslatedSignal {
  const signal = envelope.signal

  return {
    kind: "camera",
    attachment: envelope.attachment,
    label: "CAMERA SIGNAL READY",
    memoryLine: "Camera signal attached to replay memory.",
    evidence: [
      `Angle ${signal.angle}`,
      signal.videoUrl ? "External video linked" : "Camera metadata linked",
    ],
    confidence: clamp01(signal.confidence),
  }
}

export function translateSmartBallSignal(
  envelope: ExternalSignalEnvelope<SmartBallSignal>
): AxisTranslatedSignal {
  const signal = envelope.signal
  const evidence = [
    signal.shotArc != null ? `Shot arc ${signal.shotArc}` : null,
    signal.spin != null ? `Spin ${signal.spin}` : null,
    signal.releaseSpeed != null
      ? `Release speed ${signal.releaseSpeed}`
      : null,
    signal.dribbleCadence != null
      ? `Dribble cadence ${signal.dribbleCadence}`
      : null,
  ].filter((item): item is string => Boolean(item))

  return {
    kind: "ball",
    attachment: envelope.attachment,
    label: "EXTERNAL SIGNAL READY",
    memoryLine: envelope.attachment.warmupId?.includes("shooting")
      ? "Shot signal attached to Shot Form chain."
      : "Ball signal attached to warmup memory.",
    evidence,
    confidence: evidence.length ? 0.72 : 0.35,
  }
}

export function translatePoseLandmarkSignal({
  attachment,
  confidence,
  evidence,
}: {
  attachment: AxisSignalAttachment
  confidence: number
  evidence: string[]
}): AxisTranslatedSignal {
  return {
    kind: "geometry",
    attachment,
    label: "MEMORY INPUTS",
    memoryLine: attachment.warmupId?.includes("handle")
      ? "Movement geometry attached to Handle chain."
      : "Movement geometry attached to memory.",
    evidence,
    confidence: clamp01(confidence),
  }
}
