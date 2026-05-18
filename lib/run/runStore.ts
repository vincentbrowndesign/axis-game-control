import type { Run } from "@/lib/run/runState"

export const activeRunKey = "axis-active-run"
export const storedRunsKey = "axis-stored-runs"

export function readStoredRun(): Run | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(activeRunKey)

    return raw ? (JSON.parse(raw) as Run) : null
  } catch {
    return null
  }
}

export function writeStoredRun(run: Run) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(activeRunKey, JSON.stringify(run))
}

export function readStoredRuns(): Run[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(storedRunsKey)

    return raw ? (JSON.parse(raw) as Run[]) : []
  } catch {
    return []
  }
}

export function storeRun(run: Run) {
  if (typeof window === "undefined") return

  const stored = readStoredRuns()
  const next = [run, ...stored.filter((item) => item.id !== run.id)].slice(0, 12)

  window.localStorage.setItem(storedRunsKey, JSON.stringify(next))
  window.localStorage.setItem(activeRunKey, JSON.stringify(run))
}
