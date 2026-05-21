import type { AxisMotionSignature } from "@/lib/axis/perception/motionSignatures"

export const MACHINE_OBSERVATION_LABELS = [
  "weak-side collapse",
  "no help",
  "early foul",
  "and-1",
  "dead ball",
  "downhill",
  "ball pressure gone",
  "late close-out",
  "acceleration drop",
  "recovery lag",
  "balance instability",
  "burst reduction",
  "pressure movement drift",
  "containment loss",
  "fatigue slowdown",
] as const

export type AxisMachineObservationLabel = (typeof MACHINE_OBSERVATION_LABELS)[number]

export type AxisMachineObservation = {
  id: string
  label: AxisMachineObservationLabel
  tier: 1 | 2
  confidence: number
  tags: string[]
}

export type AxisObservationConfidence = "low" | "mid" | "high"

export type AxisBodyRelationshipSignal = {
  hipCenterDistance: number
  directionalContainmentLoss: number
  recoveryAngleBreak: number
  downhillLaneOpening: number
  defenderMomentumSeparation: number
}

export type AxisSubtleBiometricSignal = {
  accelerationDrop: number
  recoveryLag: number
  balanceInstability: number
  burstReduction: number
  pressureMovementDrift: number
  containmentLoss: number
  fatigueSlowdown: number
}

export function machineObservationsFromMemory(input: {
  id: string
  label: string
  tags: string[]
}): AxisMachineObservation[] {
  const normalized = input.label.toLowerCase()
  const tags = new Set(input.tags.map((tag) => tag.toLowerCase()))
  const observations: AxisMachineObservation[] = []

  if (/\bweak[- ]side\b|\bcollapse\b/.test(normalized)) {
    observations.push(observation(input.id, "weak-side collapse", 1, 0.82, ["collapse", "pressure"]))
  }

  if (/\bno help\b|\blate help\b|help\b/.test(normalized)) {
    observations.push(observation(input.id, "no help", 1, 0.76, ["help", "breakdown"]))
  }

  if (tags.has("foul") || /\bearly foul\b/.test(normalized)) {
    observations.push(observation(input.id, "early foul", 1, 0.72, ["foul", "pressure"]))
  }

  if (/\band[- ]?1\b/.test(normalized)) {
    observations.push(observation(input.id, "and-1", 1, 0.84, ["foul", "scoring"]))
  }

  if (/\bdead ball\b|\bstoppage\b/.test(normalized)) {
    observations.push(observation(input.id, "dead ball", 1, 0.88, ["dead_ball"]))
  }

  if (/\bdownhill\b/.test(normalized)) {
    observations.push(observation(input.id, "downhill", 2, 0.72, ["downhill", "pressure"]))
  }

  if (/\blate close[- ]?out\b|closeout\b/.test(normalized)) {
    observations.push(observation(input.id, "late close-out", 2, 0.74, ["closeout", "shot"]))
  }

  return observations
}

export function machineObservationsFromBodyRelationship(
  id: string,
  signal: AxisBodyRelationshipSignal,
): AxisMachineObservation[] {
  const observations: AxisMachineObservation[] = []

  if (
    signal.hipCenterDistance >= 0.42 &&
    signal.directionalContainmentLoss >= 0.58 &&
    signal.recoveryAngleBreak >= 0.5 &&
    signal.downhillLaneOpening >= 0.54 &&
    signal.defenderMomentumSeparation >= 0.5
  ) {
    observations.push(observation(id, "ball pressure gone", 2, 0.78, ["containment", "pressure"]))
  }

  if (
    signal.downhillLaneOpening >= 0.62 &&
    signal.directionalContainmentLoss >= 0.54 &&
    signal.defenderMomentumSeparation >= 0.48
  ) {
    observations.push(observation(id, "downhill", 2, 0.74, ["downhill", "pressure"]))
  }

  return observations
}

export function machineObservationsFromSubtleBiometrics(
  id: string,
  signal: AxisSubtleBiometricSignal,
): AxisMachineObservation[] {
  const observations: AxisMachineObservation[] = []

  if (signal.containmentLoss >= 0.62 && signal.pressureMovementDrift >= 0.48) {
    observations.push(observation(id, "containment loss", 2, 0.74, ["containment", "pressure", "movement"]))
  }

  if (signal.recoveryLag >= 0.58 && signal.accelerationDrop >= 0.42) {
    observations.push(observation(id, "recovery lag", 2, 0.7, ["recovery", "pressure", "movement"]))
  }

  if (signal.balanceInstability >= 0.6 && signal.pressureMovementDrift >= 0.4) {
    observations.push(observation(id, "balance instability", 2, 0.68, ["balance", "pressure", "movement"]))
  }

  if (signal.burstReduction >= 0.64 || signal.fatigueSlowdown >= 0.66) {
    observations.push(observation(id, "burst reduction", 2, 0.66, ["burst", "fatigue", "movement"]))
  }

  return observations
}

export function machineObservationsFromMotionSignatures(
  id: string,
  signatures: AxisMotionSignature[],
): AxisMachineObservation[] {
  const pressureCount = signatures.filter((signature) => signature.type === "pressure_streak").length
  const shotArcCount = signatures.filter((signature) => signature.type === "shot_arc").length
  const observations: AxisMachineObservation[] = []

  if (pressureCount >= 2) {
    observations.push(observation(id, "downhill", 2, 0.7, ["pressure", "motion"]))
  }

  if (pressureCount >= 1 && shotArcCount >= 1) {
    observations.push(observation(id, "late close-out", 2, 0.68, ["shot", "pressure"]))
  }

  return observations
}

export function observationConfidence(confidence: number): AxisObservationConfidence {
  if (confidence >= 0.8) return "high"
  if (confidence >= 0.7) return "mid"
  return "low"
}

export function observationClosure(label: AxisMachineObservationLabel, coachText: string, confidence = 1) {
  const closure = coachText.trim()
  const band = observationConfidence(confidence)

  if (band === "low") return `${label}?`
  if (band === "mid") return `${label}?`
  if (!closure) return label
  return `${label} -> ${closure}`
}

function observation(
  sourceId: string,
  label: AxisMachineObservationLabel,
  tier: 1 | 2,
  confidence: number,
  tags: string[],
): AxisMachineObservation {
  return {
    id: `${sourceId}-${label.replaceAll(" ", "-")}`,
    label,
    tier,
    confidence,
    tags,
  }
}
