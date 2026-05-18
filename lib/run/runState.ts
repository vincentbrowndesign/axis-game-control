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
  signals: RunSignal[]
  moments: RunMoment[]
  memories: RunMemory[]
}

export function createRun(): Run {
  return {
    id: crypto.randomUUID(),
    home: "Home",
    away: "Away",
    startedAt: Date.now(),
    signals: [],
    moments: [],
    memories: [],
  }
}

export function elapsedRunMs(run: Run, now = Date.now()) {
  return Math.max(0, now - run.startedAt)
}

export function formatRunTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`
}
