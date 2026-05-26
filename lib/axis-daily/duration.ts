type AxisCompletedTimeRecord = {
  checked_out_at: string | null
  duration_minutes?: number | null
  occurred_at: string
}

export function completedSessionMinutes(record: AxisCompletedTimeRecord) {
  if (!record.checked_out_at) return 0

  const startedAt = new Date(record.occurred_at).getTime()
  const endedAt = new Date(record.checked_out_at).getTime()
  const diffMinutes = Math.round((endedAt - startedAt) / 60000)

  if (Number.isFinite(diffMinutes) && diffMinutes > 0) {
    return Math.min(diffMinutes, 600)
  }

  const fallback = Number(record.duration_minutes || 0)

  return Number.isFinite(fallback) && fallback > 0
    ? Math.min(Math.round(fallback), 600)
    : 0
}

export function completedMinutesBetween(
  records: AxisCompletedTimeRecord[],
  start: Date,
  end: Date
) {
  return records
    .filter((record) => {
      const occurredAt = new Date(record.occurred_at)

      return occurredAt >= start && occurredAt < end
    })
    .reduce((total, record) => total + completedSessionMinutes(record), 0)
}

export function completedMinutesThisMonth(records: AxisCompletedTimeRecord[]) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return completedMinutesBetween(records, start, end)
}

export function completedMinutesThisWeek(records: AxisCompletedTimeRecord[]) {
  const start = startOfWeek(new Date())
  const end = new Date(start)
  end.setDate(start.getDate() + 7)

  return completedMinutesBetween(records, start, end)
}

export function formatEffortHours(minutes: number) {
  if (minutes <= 0) return "0h"

  const hours = minutes / 60

  return hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`
}

export function formatSessionDuration(minutes: number) {
  if (minutes <= 0) return "not completed"

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (!hours) return `${rest}m`
  if (!rest) return `${hours}h`

  return `${hours}h ${String(rest).padStart(2, "0")}m`
}

export function totalCompletedMinutes(records: AxisCompletedTimeRecord[]) {
  return records.reduce(
    (total, record) => total + completedSessionMinutes(record),
    0
  )
}

function startOfWeek(date: Date) {
  const start = new Date(date)
  const day = start.getDay()
  const offset = day === 0 ? 6 : day - 1
  start.setDate(start.getDate() - offset)
  start.setHours(0, 0, 0, 0)

  return start
}
