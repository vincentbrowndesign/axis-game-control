import type { TelemetrySample } from "@/lib/axis-replay/telemetry"

export type AtmosphericState = {
  clockMs: number
  density: number
  drift: number
  hoverMs: number | null
  persistence: number
  pressure: number
  readMs: number
  wake: Array<{ bornAt: number; pressure: number; timestampMs: number; x: number }>
}

export function createAtmosphericState(): AtmosphericState {
  return {
    clockMs: 0,
    density: 0,
    drift: 0,
    hoverMs: null,
    persistence: 0,
    pressure: 0,
    readMs: 0,
    wake: [],
  }
}

export function updateAtmosphere(state: AtmosphericState, sample: TelemetrySample | null, readMs: number, now: number) {
  const pressure = sample?.smoothedPressure ?? 0
  const density = sample?.smoothedDensity ?? 0
  const targetPersistence = Math.max(pressure, density * 0.8)

  state.clockMs = now
  state.readMs = readMs
  state.pressure += (pressure - state.pressure) * 0.08
  state.density += (density - state.density) * 0.08
  state.persistence += (targetPersistence - state.persistence) * 0.04
  state.drift = state.drift * 0.985 + (pressure - 0.45) * 0.006

  if (targetPersistence > 0.42 && (state.wake.at(-1)?.timestampMs ?? -10000) + 420 < readMs) {
    state.wake.push({
      bornAt: now,
      pressure: targetPersistence,
      timestampMs: readMs,
      x: 0,
    })
  }

  state.wake = state.wake.filter((wake) => now - wake.bornAt < 5200)
}

export function setAtmosphereHover(state: AtmosphericState, timestampMs: number | null) {
  state.hoverMs = timestampMs
}
