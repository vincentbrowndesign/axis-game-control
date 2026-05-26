import { supabaseAdmin } from "@/lib/supabase/admin"
import { completedSessionMinutes } from "@/lib/axis-daily/duration"

type LeaderboardCheckInRow = {
  checked_out_at: string | null
  clerk_user_id: string | null
  duration_minutes: number
  occurred_at: string
  status: string
  user_id: string | null
}

export type AxisLeaderboardEntry = {
  id: string
  label: string
  meta: string
  rank: number
  value: string
}

export type AxisLeaderboardCategory = {
  entries: AxisLeaderboardEntry[]
  id: string
  title: string
}

type MemberLedger = {
  id: string
  dates: Set<string>
  monthlyDates: Set<string>
  sessions: number
  sessionsToday: number
  totalMinutesThisWeek: number
}

export async function getAxisLeaderboard(
  organizationId?: string | null
): Promise<AxisLeaderboardCategory[]> {
  const since = new Date()
  since.setMonth(since.getMonth() - 6)
  since.setHours(0, 0, 0, 0)

  let query = supabaseAdmin
      .from("axis_training_check_ins")
      .select("clerk_user_id, user_id, status, duration_minutes, occurred_at, checked_out_at")
      .gte("occurred_at", since.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(3000)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const result = await Promise.race([
    query.returns<LeaderboardCheckInRow[]>(),
    timeoutResult(4500),
  ])

  if (result.error) {
    return emptyCategories()
  }

  const ledgers = buildLedgers(result.data || [])

  return [
    {
      entries: rankedEntries(ledgers, (ledger) => ledger.sessionsToday, {
        format: (value) => `${value} ${value === 1 ? "check-in" : "check-ins"}`,
        meta: "checked in today",
      }),
      id: "active-today",
      title: "Most Active Today",
    },
    {
      entries: rankedEntries(ledgers, (ledger) => ledger.totalMinutesThisWeek, {
        format: formatHours,
        meta: "verified hours this week",
      }),
      id: "hours-this-week",
      title: "Most Hours This Week",
    },
    {
      entries: rankedEntries(ledgers, activeStreakDays, {
        format: (value) => `${value} ${value === 1 ? "day" : "days"}`,
        meta: "active streak",
      }),
      id: "active-streak",
      title: "Longest Active Streak",
    },
    {
      entries: rankedEntries(ledgers, (ledger) => ledger.monthlyDates.size, {
        format: (value) => `${value} ${value === 1 ? "day" : "days"}`,
        meta: "active days this month",
      }),
      id: "monthly-consistency",
      title: "Most Consistent This Month",
    },
    {
      entries: rankedEntries(ledgers, (ledger) => ledger.sessions, {
        format: (value) => `${value} ${value === 1 ? "session" : "sessions"}`,
        meta: "all-time check-ins",
      }),
      id: "sessions-completed",
      title: "Most Sessions Completed",
    },
  ]
}

function buildLedgers(rows: LeaderboardCheckInRow[]) {
  const ledgers = new Map<string, MemberLedger>()
  const todayKey = toDateKey(new Date())
  const weekStart = startOfWeek(new Date())
  const monthKey = toMonthKey(new Date())

  for (const row of rows) {
    if (row.status !== "checked_in") continue

    const id = row.clerk_user_id || row.user_id
    if (!id) continue

    const occurredAt = new Date(row.occurred_at)
    const ledger = ledgers.get(id) || {
      dates: new Set<string>(),
      id,
      monthlyDates: new Set<string>(),
      sessions: 0,
      sessionsToday: 0,
      totalMinutesThisWeek: 0,
    }
    const dateKey = toDateKey(occurredAt)

    ledger.dates.add(dateKey)

    if (row.checked_out_at) {
      ledger.sessions += 1
    }

    if (occurredAt >= weekStart) {
      ledger.totalMinutesThisWeek += completedSessionMinutes(row)
    }

    if (dateKey === todayKey) {
      ledger.sessionsToday += 1
    }

    if (toMonthKey(occurredAt) === monthKey) {
      ledger.monthlyDates.add(dateKey)
    }

    ledgers.set(id, ledger)
  }

  return Array.from(ledgers.values())
}

function rankedEntries(
  ledgers: MemberLedger[],
  valueFor: (ledger: MemberLedger) => number,
  options: {
    format: (value: number) => string
    meta: string
  }
) {
  return ledgers
    .map((ledger) => ({
      ledger,
      value: valueFor(ledger),
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || a.ledger.id.localeCompare(b.ledger.id))
    .slice(0, 8)
    .map((entry, index) => ({
      id: entry.ledger.id,
      label: memberFileLabel(entry.ledger.id),
      meta: options.meta,
      rank: index + 1,
      value: options.format(entry.value),
    }))
}

function activeStreakDays(ledger: MemberLedger) {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (!ledger.dates.has(toDateKey(today)) && !ledger.dates.has(toDateKey(yesterday))) {
    return 0
  }

  let streak = 0
  const cursor = new Date(today)

  while (ledger.dates.has(toDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  if (streak === 0 && ledger.dates.has(toDateKey(yesterday))) {
    cursor.setTime(yesterday.getTime())
    while (ledger.dates.has(toDateKey(cursor))) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  return streak
}

function emptyCategories(): AxisLeaderboardCategory[] {
  return [
    { entries: [], id: "active-today", title: "Most Active Today" },
    { entries: [], id: "hours-this-week", title: "Most Hours This Week" },
    { entries: [], id: "active-streak", title: "Longest Active Streak" },
    { entries: [], id: "monthly-consistency", title: "Most Consistent This Month" },
    { entries: [], id: "sessions-completed", title: "Most Sessions Completed" },
  ]
}

function formatHours(minutes: number) {
  const hours = minutes / 60

  if (hours < 1) {
    return `${minutes} min`
  }

  return `${hours.toFixed(hours >= 10 ? 0 : 1)} hr`
}

function memberFileLabel(value: string) {
  const suffix = value.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()

  return suffix ? `FILE ${suffix}` : "FILE"
}

function startOfWeek(date: Date) {
  const start = new Date(date)
  const day = start.getDay()
  const offset = day === 0 ? 6 : day - 1
  start.setDate(start.getDate() - offset)
  start.setHours(0, 0, 0, 0)

  return start
}

function timeoutResult(milliseconds: number) {
  return new Promise<{
    data: LeaderboardCheckInRow[] | null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Leaderboard timed out"),
        }),
      milliseconds
    )
  })
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toMonthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}
