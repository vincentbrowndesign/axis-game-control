import type { SystemPlusMinus } from "@/lib/engine/systemPlusMinus"

export function momentumState(system: SystemPlusMinus) {
  if (system.label === "BREAK") return "Break"
  if (system.label === "SPURT") return "Spurt"
  if (system.label === "COLD") return "Cold stretch"
  if (system.label === "SWING") return "Swing"

  return "Stable flow"
}

