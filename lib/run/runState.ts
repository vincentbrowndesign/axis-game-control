import type { RunSignal } from "@/lib/run/signals"

export type RunMoment = {
  id: string
  label: string
  start: number
  end: number
  time: number
}

export type RunMemory = {
  id: string
  start: number
  end: number
  signals: RunSignal[]
  playbackId?: string
}

export type Run = {
  id: string
  home: string
  away: string
  startedAt: number
  pausedAt?: number
  pausedMs?: number
  signals: RunSignal[]
  moments: RunMoment[]
  memories: RunMemory[]
}

export function createRunId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }

  return `axis-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

export function createRun(): Run {
  return {
    id: createRunId(),
    home: "Home",
    away: "Away",
    startedAt: Date.now(),
    pausedMs: 0,
    signals: [],
    moments: [],
    memories: [],
  }
}

export function elapsedRunMs(run: Run, now = Date.now()) {
  const clockNow = run.pausedAt ?? now

  return Math.max(0, clockNow - run.startedAt - (run.pausedMs ?? 0))
}

export function formatRunTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`
}
