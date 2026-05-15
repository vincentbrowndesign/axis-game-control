export type AtmosphereState = {
  depthLabel: string
  pulseLabel: string
  intensity: number
}

export function atmosphereState({
  memoryCount = 1,
  warmupCount = 0,
}: {
  memoryCount?: number
  warmupCount?: number
}): AtmosphereState {
  const depth = Math.max(memoryCount, warmupCount, 1)

  return {
    depthLabel:
      depth >= 8 ? "Familiar" : depth >= 3 ? "Returning" : "Awake",
    pulseLabel:
      warmupCount >= 3
        ? "Rhythm held"
        : warmupCount > 0
          ? "Rhythm forming"
          : "Memory open",
    intensity: Math.min(1, 0.28 + depth * 0.08),
  }
}
