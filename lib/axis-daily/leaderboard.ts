import { supabaseAdmin } from "@/lib/supabase/admin"
import { completedSessionMinutes } from "@/lib/axis-daily/duration"
import {
  activeContinuityStreak,
  axisDateKey,
  axisMonthKey,
  axisStartOfWeek,
  axisTodayRange,
} from "@/lib/axis-daily/continuity"

type LeaderboardCheckInRow = {
  checked_out_at: string | null
  clerk_user_id: string | null
  duration_minutes: number
  occurred_at: string
  status: string
  user_id: string | null
}

type OrganizationLeaderboardCheckInRow = LeaderboardCheckInRow & {
  axis_organizations: {
    avatar: string | null
    logo: string | null
    name: string
    slug: string
  } | null
  organization_id: string | null
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

export type AxisOrganizationLeaderboardEntry = {
  detail: string
  id: string
  label: string
  rank: number
  signal: string
  slug: string
  value: string
}

export type AxisOrganizationLeaderboardCategory = {
  entries: AxisOrganizationLeaderboardEntry[]
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

type OrganizationLedger = {
  activeMembersToday: Set<string>
  completedSessions: number
  dates: Set<string>
  id: string
  label: string
  monthlyDates: Set<string>
  slug: string
  totalMinutes: number
  weeklyCheckIns: number
  weeklyMembers: Set<string>
}

export async function getAxisLeaderboard(
  organizationId?: string | null
): Promise<AxisLeaderboardCategory[]> {
  const since = new Date()
  since.setMonth(since.getMonth() - 6)
  const sinceDay = axisDayStart(since)

  let query = supabaseAdmin
      .from("axis_training_check_ins")
      .select("clerk_user_id, user_id, status, duration_minutes, occurred_at, checked_out_at")
      .gte("occurred_at", sinceDay.toISOString())
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

export async function getAxisOrganizationLeaderboard(): Promise<
  AxisOrganizationLeaderboardCategory[]
> {
  const since = new Date()
  since.setMonth(since.getMonth() - 6)
  const sinceDay = axisDayStart(since)

  const result = await Promise.race([
    supabaseAdmin
      .from("axis_training_check_ins")
      .select(
        "clerk_user_id, user_id, status, duration_minutes, occurred_at, checked_out_at, organization_id, axis_organizations(name, slug, avatar, logo)"
      )
      .eq("status", "checked_in")
      .not("organization_id", "is", null)
      .gte("occurred_at", sinceDay.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(4000)
      .returns<OrganizationLeaderboardCheckInRow[]>(),
    timeoutOrganizationResult(4500),
  ])

  if (result.error) {
    return emptyOrganizationCategories()
  }

  const ledgers = buildOrganizationLedgers(result.data || [])

  return [
    {
      entries: rankedOrganizationEntries(ledgers, (ledger) => ledger.weeklyMembers.size, {
        detail: "unique members active this week",
        format: (value) => `${value} active`,
        signal: "most active this week",
      }),
      id: "most-active-week",
      title: "Most Active Organizations",
    },
    {
      entries: rankedOrganizationEntries(ledgers, (ledger) => ledger.monthlyDates.size, {
        detail: "active days this month",
        format: (value) => `${value} ${value === 1 ? "day" : "days"}`,
        signal: "highest consistency",
      }),
      id: "highest-consistency",
      title: "Highest Consistency",
    },
    {
      entries: rankedOrganizationEntries(ledgers, activeOrganizationStreakDays, {
        detail: "organization streak",
        format: (value) => `${value} ${value === 1 ? "day" : "days"}`,
        signal: "longest org streak",
      }),
      id: "longest-org-streak",
      title: "Longest Org Streaks",
    },
    {
      entries: rankedOrganizationEntries(ledgers, (ledger) => ledger.completedSessions, {
        detail: "completed sessions",
        format: (value) => `${value} ${value === 1 ? "session" : "sessions"}`,
        signal: "most completed sessions",
      }),
      id: "completed-sessions",
      title: "Most Completed Sessions",
    },
    {
      entries: rankedOrganizationEntries(ledgers, (ledger) => ledger.totalMinutes, {
        detail: "logged from completed sessions",
        format: formatHours,
        signal: "hours logged",
      }),
      id: "hours-logged",
      title: "Hours Logged",
    },
  ]
}

function buildLedgers(rows: LeaderboardCheckInRow[]) {
  const ledgers = new Map<string, MemberLedger>()
  const todayKey = axisDateKey(new Date())
  const weekStart = axisStartOfWeek(new Date())
  const monthKey = axisMonthKey(new Date())

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
    const dateKey = axisDateKey(occurredAt)

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

    if (axisMonthKey(occurredAt) === monthKey) {
      ledger.monthlyDates.add(dateKey)
    }

    ledgers.set(id, ledger)
  }

  return Array.from(ledgers.values())
}

function buildOrganizationLedgers(rows: OrganizationLeaderboardCheckInRow[]) {
  const ledgers = new Map<string, OrganizationLedger>()
  const todayKey = axisDateKey(new Date())
  const weekStart = axisStartOfWeek(new Date())
  const monthKey = axisMonthKey(new Date())

  for (const row of rows) {
    if (!row.organization_id || !row.axis_organizations) continue

    const organization = row.axis_organizations
    const ledger = ledgers.get(row.organization_id) || {
      activeMembersToday: new Set<string>(),
      completedSessions: 0,
      dates: new Set<string>(),
      id: row.organization_id,
      label: organization.name,
      monthlyDates: new Set<string>(),
      slug: organization.slug,
      totalMinutes: 0,
      weeklyCheckIns: 0,
      weeklyMembers: new Set<string>(),
    }
    const occurredAt = new Date(row.occurred_at)
    const dateKey = axisDateKey(occurredAt)
    const member = row.clerk_user_id || row.user_id || ""

    ledger.dates.add(dateKey)

    if (axisMonthKey(occurredAt) === monthKey) {
      ledger.monthlyDates.add(dateKey)
    }

    if (occurredAt >= weekStart) {
      ledger.weeklyCheckIns += 1
      if (member) ledger.weeklyMembers.add(member)
    }

    if (dateKey === todayKey && member) {
      ledger.activeMembersToday.add(member)
    }

    if (row.checked_out_at) {
      ledger.completedSessions += 1
      ledger.totalMinutes += completedSessionMinutes(row)
    }

    ledgers.set(row.organization_id, ledger)
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

function rankedOrganizationEntries(
  ledgers: OrganizationLedger[],
  valueFor: (ledger: OrganizationLedger) => number,
  options: {
    detail: string
    format: (value: number) => string
    signal: string
  }
) {
  return ledgers
    .map((ledger) => ({
      ledger,
      value: valueFor(ledger),
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || a.ledger.label.localeCompare(b.ledger.label))
    .slice(0, 6)
    .map((entry, index) => ({
      detail: options.detail,
      id: entry.ledger.id,
      label: entry.ledger.label,
      rank: index + 1,
      signal: options.signal,
      slug: entry.ledger.slug,
      value: options.format(entry.value),
    }))
}

function activeStreakDays(ledger: MemberLedger) {
  return activeContinuityStreak(ledger.dates)
}

function activeOrganizationStreakDays(ledger: OrganizationLedger) {
  return activeContinuityStreak(ledger.dates)
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

function emptyOrganizationCategories(): AxisOrganizationLeaderboardCategory[] {
  return [
    { entries: [], id: "most-active-week", title: "Most Active Organizations" },
    { entries: [], id: "highest-consistency", title: "Highest Consistency" },
    { entries: [], id: "longest-org-streak", title: "Longest Org Streaks" },
    { entries: [], id: "completed-sessions", title: "Most Completed Sessions" },
    { entries: [], id: "hours-logged", title: "Hours Logged" },
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

function axisDayStart(date: Date) {
  return axisTodayRange(date).start
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

function timeoutOrganizationResult(milliseconds: number) {
  return new Promise<{
    data: OrganizationLeaderboardCheckInRow[] | null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Organization leaderboard timed out"),
        }),
      milliseconds
    )
  })
}
