import type { TelemetrySample } from "@/lib/axis-replay/telemetry"

export type ReplayMode = "idle" | "drifting" | "window"

export type ReplayMachine = {
  mode: ReplayMode
  targetMs: number
  velocityMs: number
  windowEndMs: number | null
  windowStartMs: number | null
}

export function createReplayMachine(): ReplayMachine {
  return {
    mode: "idle",
    targetMs: 0,
    velocityMs: 0,
    windowEndMs: null,
    windowStartMs: null,
  }
}

export function enterReplayWindow(machine: ReplayMachine, knotMs: number, frames: TelemetrySample[]) {
  const source = findWindow(knotMs, frames)
  const start = source?.start_ms ?? Math.max(0, knotMs - 2400)
  const end = source?.end_ms ?? knotMs + 3200

  machine.mode = "window"
  machine.targetMs = start + (knotMs - start) * 0.22
  machine.velocityMs += -180
  machine.windowStartMs = start
  machine.windowEndMs = end
}

export function seekWithInertia(machine: ReplayMachine, targetMs: number, push = 0) {
  machine.mode = "drifting"
  machine.targetMs = Math.max(0, targetMs)
  machine.velocityMs += push
  machine.windowStartMs = null
  machine.windowEndMs = null
}

export function updateReplayMachine(machine: ReplayMachine, video: HTMLVideoElement, deltaSeconds: number) {
  if (machine.mode === "idle" || !Number.isFinite(video.duration)) return

  const currentMs = video.currentTime * 1000
  const pull = (machine.targetMs - currentMs) * 0.062
  machine.velocityMs = (machine.velocityMs + pull) * Math.pow(0.82, deltaSeconds * 60)
  const nextMs = currentMs + machine.velocityMs * deltaSeconds
  const clamped = clamp(nextMs, 0, video.duration * 1000)

  if (Math.abs(clamped - currentMs) > 14) {
    video.currentTime = clamped / 1000
  }

  if (machine.mode === "window" && machine.windowEndMs !== null && currentMs >= machine.windowEndMs - 80) {
    machine.targetMs = machine.windowStartMs ?? Math.max(0, machine.windowEndMs - 4200)
    machine.velocityMs -= 70
  }

  if (Math.abs(machine.targetMs - currentMs) < 34 && Math.abs(machine.velocityMs) < 18) {
    machine.mode = machine.windowEndMs === null ? "idle" : "window"
  }
}

function findWindow(knotMs: number, frames: TelemetrySample[]) {
  let strongest: TelemetrySample["topology"]["windows"][number] | null = null
  for (const frame of frames) {
    for (const windowValue of frame.topology.windows) {
      if (knotMs < windowValue.start_ms || knotMs > windowValue.end_ms) continue
      if (!strongest || windowValue.weight > strongest.weight) strongest = windowValue
    }
  }
  return strongest
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
