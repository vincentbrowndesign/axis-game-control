const AXIS_TIME_ZONE = process.env.AXIS_TIME_ZONE || "America/Chicago"

type AxisDateParts = {
  day: number
  hour: number
  minute: number
  month: number
  second: number
  year: number
}

const axisDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: AXIS_TIME_ZONE,
  year: "numeric",
})

export function axisDateKey(date: Date) {
  const parts = axisDateParts(date)

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-")
}

export function axisMonthKey(date: Date) {
  return axisDateKey(date).slice(0, 7)
}

export function axisTodayRange(now = new Date()) {
  return axisDayRange(now)
}

export function axisDayRange(date: Date) {
  const parts = axisDateParts(date)
  const start = axisLocalTimeToUtc(parts.year, parts.month, parts.day)
  const nextDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1))
  const end = axisLocalTimeToUtc(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate()
  )

  return { end, start }
}

export function axisStartOfWeek(date: Date) {
  const parts = axisDateParts(date)
  const localNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))
  const day = localNoon.getUTCDay()
  const offset = day === 0 ? 6 : day - 1
  localNoon.setUTCDate(localNoon.getUTCDate() - offset)

  return axisLocalTimeToUtc(
    localNoon.getUTCFullYear(),
    localNoon.getUTCMonth() + 1,
    localNoon.getUTCDate()
  )
}

export function activeContinuityStreak(days: Set<string>, now = new Date()) {
  const today = axisDateKey(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = axisDateKey(yesterdayDate)

  if (!days.has(today) && !days.has(yesterday)) return 0

  let streak = 0
  const cursor = new Date(days.has(today) ? now : yesterdayDate)

  while (days.has(axisDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function axisDateParts(date: Date): AxisDateParts {
  const parts = axisDateFormatter.formatToParts(date)
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  )

  return {
    day: lookup.day,
    hour: lookup.hour === 24 ? 0 : lookup.hour,
    minute: lookup.minute,
    month: lookup.month,
    second: lookup.second,
    year: lookup.year,
  }
}

function axisLocalTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
) {
  let utcTime = Date.UTC(year, month - 1, day, hour, minute, second)

  for (let index = 0; index < 2; index += 1) {
    const parts = axisDateParts(new Date(utcTime))
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
    utcTime -= representedUtc - utcTime
  }

  return new Date(utcTime)
}
