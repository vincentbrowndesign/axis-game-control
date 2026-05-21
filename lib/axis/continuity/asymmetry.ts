import type { SigmaEdgeDirection } from "@/lib/axis/continuity/fieldTypes"

export const FORWARD_PROPAGATION_MULTIPLIER = 1.8
export const BACKWARD_PROPAGATION_MULTIPLIER = 0.6
export const LATERAL_PROPAGATION_MULTIPLIER = 1
export const MIN_ANCHOR_SIGMA = 0.3
export const MAX_SIGMA = 1
export const IMPEDANCE_FLOOR = 0.1

export function directionalMultiplier(direction: SigmaEdgeDirection) {
  if (direction === "forward") return FORWARD_PROPAGATION_MULTIPLIER
  if (direction === "backward") return BACKWARD_PROPAGATION_MULTIPLIER
  return LATERAL_PROPAGATION_MULTIPLIER
}

export function impedanceWeight(impedance: number) {
  if (!Number.isFinite(impedance)) return 1
  return 1 / Math.max(IMPEDANCE_FLOOR, impedance)
}

export function clampSigma(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_SIGMA, value))
}
