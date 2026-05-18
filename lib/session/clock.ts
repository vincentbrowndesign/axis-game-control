export function minutesToMs(value: number | undefined, fallbackMinutes: number) {
  if (!value || !Number.isFinite(value)) return fallbackMinutes * 60 * 1000

  return Math.max(1, Math.floor(value)) * 60 * 1000
}

export function formatClockMs(value: number) {
  const safeMs = Math.max(0, Math.floor(value))
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function elapsedSessionMs({
  createdAt,
  now,
  clockEnabled,
  clockMs,
  periodLengthMs,
}: {
  createdAt: number
  now: number
  clockEnabled: boolean
  clockMs: number
  periodLengthMs?: number
}) {
  if (clockEnabled && periodLengthMs) {
    return Math.max(0, periodLengthMs - clockMs)
  }

  return Math.max(0, now - createdAt)
}
