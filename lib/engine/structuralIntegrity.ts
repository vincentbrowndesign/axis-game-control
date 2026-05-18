import type { SystemPlusMinus } from "@/lib/engine/systemPlusMinus"

export function structuralIntegrityLabel(system: SystemPlusMinus) {
  if (system.structuralIntegrity >= 0.72) return "Stable flow"
  if (system.structuralIntegrity <= 0.38) return "Flow broke"
  if (system.pressure >= 0.55) return "Pressure building"

  return "Flow holding"
}

