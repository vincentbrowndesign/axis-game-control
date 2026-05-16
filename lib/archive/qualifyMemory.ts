import type {
  ArchiveQualification,
  ArchiveQualificationReason,
  MemoryArchiveItem,
} from "./types"

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

export function qualifyMemory(
  item: MemoryArchiveItem
): ArchiveQualification {
  const reasons: ArchiveQualificationReason[] = ["memory_exists"]
  const { session, signals, segmentedMemory, markers = [] } = item
  const duration = session.duration || signals?.duration || 0
  const hasMission = Boolean(
    session.mission && session.mission !== "None"
  )
  const hasSignal =
    Boolean(signals?.frameSampleCount) ||
    Boolean(signals?.audioEnergy) ||
    Boolean(segmentedMemory?.segments.length)
  const hasRhythm = markers.some(
    (marker) => marker.type === "rhythm" || marker.type === "cadence"
  )
  const hasReset = markers.some((marker) => marker.type === "reset")
  const hasContinuity = markers.some(
    (marker) =>
      marker.type === "continuity" ||
      marker.type === "repetition" ||
      marker.type === "stabilization"
  )

  if (hasMission) reasons.push("warmup_memory")
  if (hasSignal) reasons.push("signal_recorded")
  if (hasRhythm) reasons.push("rhythm_found")
  if (hasReset) reasons.push("reset_found")
  if (hasContinuity) reasons.push("continuity_found")
  if (duration > 0 && duration < 4) reasons.push("too_short")
  if (!hasSignal) reasons.push("low_signal")

  const confidence = clamp01(
    0.28 +
      (hasMission ? 0.18 : 0) +
      (hasSignal ? 0.2 : 0) +
      (hasRhythm ? 0.16 : 0) +
      (hasReset ? 0.08 : 0) +
      (hasContinuity ? 0.1 : 0) -
      (duration > 0 && duration < 4 ? 0.18 : 0) -
      (!hasSignal ? 0.12 : 0)
  )

  if (confidence >= 0.68) {
    return {
      action: "mark_useful",
      confidence,
      reasons: unique(reasons),
      label: "Mark Useful",
    }
  }

  if (confidence >= 0.38) {
    return {
      action: "keep",
      confidence,
      reasons: unique(reasons),
      label: "Keep Memory",
    }
  }

  return {
    action: "discard",
    confidence,
    reasons: unique(reasons),
    label: "Discard Memory",
  }
}
