import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  normalizeSessionSegments,
  type AxisSessionSegment,
} from "@/lib/axis-daily/session-flow"
import { totalCompletedMinutes } from "@/lib/axis-daily/duration"
import {
  activeContinuityStreak,
  axisDateKey,
  axisStartOfWeek,
  axisTodayRange,
} from "@/lib/axis-daily/continuity"

export type AxisTrainingCheckIn = {
  checked_out_at: string | null
  id: string
  reflection: string | null
  session_segments: AxisSessionSegment[]
  status: string
  workout_type: string
  duration_minutes: number
  notes: string | null
  distance_meters: number
  occurred_at: string
}

export type AxisAttendanceSummary = {
  checkIns: AxisTrainingCheckIn[]
  streakDays: number
  totalMinutes: number
}

export type AxisParticipationSignal = {
  label: string
  value: string
}

export type AxisOrganizationCulture = {
  activeSessions: number
  avatar: string
  detail: string
  metric: string
  name: string
  signal: string
  streakLeaderDays: number
  slug: string
  weeklyMembers: number
}

type ParticipationCheckInRow = {
  axis_organizations: {
    avatar: string | null
    logo: string | null
    name: string
    slug: string
  } | null
  checked_out_at: string | null
  clerk_user_id: string | null
  id: string
  occurred_at: string
  organization_id: string | null
  user_id: string | null
}

export async function getAttendanceSummary(
  identity: AxisRequestIdentity,
  limit = 30,
  organizationId?: string | null
): Promise<AxisAttendanceSummary> {
  const emptySummary = {
    checkIns: [],
    streakDays: 0,
    totalMinutes: 0,
  }
  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select(
      "id, status, workout_type, duration_minutes, notes, distance_meters, occurred_at, checked_out_at, reflection, session_segments"
    )
    .order("occurred_at", { ascending: false })
    .limit(limit)

  query =
    identity.supabaseUserId && identity.clerkUserId
      ? query.or(
          `user_id.eq.${identity.supabaseUserId},clerk_user_id.eq.${identity.clerkUserId}`
        )
      : identity.supabaseUserId
        ? query.eq("user_id", identity.supabaseUserId)
        : query.eq("clerk_user_id", identity.clerkUserId || "")

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const result = await Promise.race([
    query.returns<AxisTrainingCheckIn[]>(),
    timeoutResult(4500),
  ])

  if (result.error) {
    return emptySummary
  }

  const checkIns = (result.data || []).map((checkIn) => ({
    ...checkIn,
    session_segments: normalizeSessionSegments(checkIn.session_segments),
  }))

  return {
    checkIns,
    streakDays: calculateStreak(checkIns),
    totalMinutes: totalCompletedMinutes(checkIns),
  }
}

export async function getActiveTodayCount(organizationId?: string | null) {
  const today = axisTodayRange()

  let query = supabaseAdmin
      .from("axis_training_check_ins")
      .select("id, user_id, clerk_user_id")
      .eq("status", "checked_in")
      .gte("occurred_at", today.start.toISOString())
      .lt("occurred_at", today.end.toISOString())

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const result = await Promise.race([
    query.returns<
      {
        clerk_user_id: string | null
        id: string
        user_id: string | null
      }[]
    >(),
    timeoutActiveTodayResult(4500),
  ])

  if (result.error) {
    return 0
  }

  return new Set(
    (result.data || [])
      .map((row) => row.clerk_user_id || row.user_id || row.id)
      .filter(Boolean)
  ).size
}

export async function getParticipationSignals(organizationId?: string | null) {
  const today = axisTodayRange()
  const weekStart = axisStartOfWeek(new Date())
  const since = new Date(today.start)
  since.setDate(today.start.getDate() - 30)

  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select(
      "id, user_id, clerk_user_id, organization_id, occurred_at, checked_out_at, axis_organizations(name, slug, avatar, logo)"
    )
    .eq("status", "checked_in")
    .gte("occurred_at", since.toISOString())
    .lt("occurred_at", today.end.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(700)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const result = await Promise.race([
    query.returns<ParticipationCheckInRow[]>(),
    timeoutParticipationResult(4500),
  ])

  if (result.error) {
    return emptyParticipationSignals(organizationId)
  }

  const rows = result.data || []
  const todayRows = rows.filter((row) => new Date(row.occurred_at) >= today.start)
  const weekRows = rows.filter((row) => new Date(row.occurred_at) >= weekStart)
  const todayMembers = new Set(todayRows.map(memberKey).filter(Boolean))
  const weekMembers = new Set(weekRows.map(memberKey).filter(Boolean))
  const yesterdayMembers = new Set(
    rows
      .filter((row) => isYesterday(row.occurred_at, today.start))
      .map(memberKey)
      .filter(Boolean)
  )
  const streaksExtendedToday = Array.from(todayMembers).filter((key) =>
    yesterdayMembers.has(key)
  ).length
  const completedToday = todayRows.filter((row) => row.checked_out_at).length
  const activeSessionCount = todayRows.filter((row) => !row.checked_out_at).length
  const streakLeaderDays = findTopStreakDays(rows)
  const activeOrganizations = organizationActivity(todayRows)
  const leadingOrganization = leadingWeeklyOrganization(weekRows)
  const recent = todayRows
    .slice(0, 3)
    .map((row) => {
      const orgName = row.axis_organizations?.name || "Axis"
      return `${orgName} - ${formatAttendanceTime(row.occurred_at)}`
    })
    .join(" / ")

  if (organizationId) {
    return [
      {
        label: "active today",
        value: todayMembers.size ? `${todayMembers.size} active today` : "floor opening",
      },
      {
        label: "this week",
        value: weekMembers.size
          ? `${weekMembers.size} active this week`
          : "week opening",
      },
      {
        label: "active sessions",
        value: activeSessionCount
          ? `${activeSessionCount} active right now`
          : completedToday
            ? `${completedToday} completed today`
            : "floor opening",
      },
      {
        label: "streak leader",
        value: streakLeaderDays
          ? `${streakLeaderDays} day streak`
          : streaksExtendedToday
            ? `${streaksExtendedToday} streak${streaksExtendedToday === 1 ? "" : "s"} extended`
            : "streaks waiting",
      },
      {
        label: "recent check-ins",
        value: recent || "first check-in waiting",
      },
    ] satisfies AxisParticipationSignal[]
  }

  return [
    {
      label: "active today",
      value: todayMembers.size ? `${todayMembers.size} active today` : "floor opening",
    },
    {
      label: "active sessions",
      value: activeSessionCount
        ? `${activeSessionCount} active right now`
        : completedToday
          ? `${completedToday} completed today`
          : "sessions waiting",
    },
    {
      label: "this week",
      value: weekMembers.size
        ? `${weekMembers.size} active this week`
        : "week opening",
    },
    {
      label: "organizations live",
      value: activeOrganizations || "org worlds quiet",
    },
    {
      label: "streak movement",
      value: streaksExtendedToday
        ? `${streaksExtendedToday} streak${streaksExtendedToday === 1 ? "" : "s"} extended today`
        : "streaks waiting",
    },
    {
      label: "recent check-ins",
      value: recent || "first check-in waiting",
    },
    {
      label: "leading this week",
      value: leadingOrganization || "board open",
    },
  ] satisfies AxisParticipationSignal[]
}

export async function getOrganizationCulture(organizationId?: string | null) {
  const today = axisTodayRange()
  const since = new Date(today.start)
  since.setDate(today.start.getDate() - 30)

  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select(
      "id, user_id, clerk_user_id, organization_id, occurred_at, checked_out_at, axis_organizations(name, slug, avatar, logo)"
    )
    .eq("status", "checked_in")
    .gte("occurred_at", since.toISOString())
    .lt("occurred_at", today.end.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(900)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const result = await Promise.race([
    query.returns<ParticipationCheckInRow[]>(),
    timeoutParticipationResult(4500),
  ])

  if (result.error) {
    return [] satisfies AxisOrganizationCulture[]
  }

  return buildOrganizationCulture(result.data || [], today.start)
}

function timeoutResult(milliseconds: number) {
  return new Promise<{
    data: AxisTrainingCheckIn[] | null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Attendance memory timed out"),
        }),
      milliseconds
    )
  })
}

function timeoutParticipationResult(milliseconds: number) {
  return new Promise<{
    data: ParticipationCheckInRow[] | null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Participation signal timed out"),
        }),
      milliseconds
    )
  })
}

function timeoutActiveTodayResult(milliseconds: number) {
  return new Promise<{
    data: {
      clerk_user_id: string | null
      id: string
      user_id: string | null
    }[] | null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Attendance count timed out"),
        }),
      milliseconds
    )
  })
}

export function calculateStreak(checkIns: AxisTrainingCheckIn[]) {
  const days = new Set(
    checkIns.map((checkIn) => axisDateKey(new Date(checkIn.occurred_at)))
  )

  return activeContinuityStreak(days)
}

export function formatAttendanceDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value))
}

function formatAttendanceTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function emptyParticipationSignals(organizationId?: string | null) {
  if (organizationId) {
    return [
      { label: "active today", value: "floor opening" },
      { label: "this week", value: "week opening" },
      { label: "active sessions", value: "floor opening" },
      { label: "streak leader", value: "streaks waiting" },
      { label: "recent check-ins", value: "first check-in waiting" },
    ] satisfies AxisParticipationSignal[]
  }

  return [
    { label: "active today", value: "floor opening" },
    { label: "active sessions", value: "sessions waiting" },
    { label: "this week", value: "week opening" },
    { label: "organizations live", value: "org worlds quiet" },
    { label: "streak movement", value: "streaks waiting" },
    { label: "recent check-ins", value: "first check-in waiting" },
    { label: "leading this week", value: "board open" },
  ] satisfies AxisParticipationSignal[]
}

function memberKey(row: ParticipationCheckInRow) {
  return row.clerk_user_id || row.user_id || ""
}

function isYesterday(value: string, today: Date) {
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const date = new Date(value)

  return axisDateKey(date) === axisDateKey(yesterday)
}

function organizationActivity(rows: ParticipationCheckInRow[]) {
  const counts = countOrganizations(rows)

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([name, count]) => `${name} - ${count} checked in`)
    .join(" / ")
}

function leadingWeeklyOrganization(rows: ParticipationCheckInRow[]) {
  const counts = countOrganizations(rows)
  const leader = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )[0]

  return leader ? `${leader[0]} leading this week` : ""
}

function findTopStreakDays(rows: ParticipationCheckInRow[]) {
  const memberDates = new Map<string, Set<string>>()

  for (const row of rows) {
    const key = memberKey(row)
    if (!key) continue

    const dates = memberDates.get(key) || new Set<string>()
    dates.add(axisDateKey(new Date(row.occurred_at)))
    memberDates.set(key, dates)
  }

  return Array.from(memberDates.values()).reduce(
    (leader, dates) => Math.max(leader, calculateDateSetStreak(dates)),
    0
  )
}

function buildOrganizationCulture(rows: ParticipationCheckInRow[], today: Date) {
  const weekStart = axisStartOfWeek(today)
  const groups = new Map<
    string,
    {
      activeSessions: number
      avatar: string
      completedToday: number
      dates: Set<string>
      memberDates: Map<string, Set<string>>
      membersToday: Set<string>
      membersYesterday: Set<string>
      membersThisWeek: Set<string>
      name: string
      slug: string
      weeklyCheckIns: number
    }
  >()

  for (const row of rows) {
    if (!row.axis_organizations) continue

    const slug = row.axis_organizations.slug
    const group = groups.get(slug) || {
      avatar:
        row.axis_organizations.logo ||
        row.axis_organizations.avatar ||
        row.axis_organizations.name.slice(0, 2).toUpperCase(),
      activeSessions: 0,
      completedToday: 0,
      dates: new Set<string>(),
      memberDates: new Map<string, Set<string>>(),
      membersToday: new Set<string>(),
      membersYesterday: new Set<string>(),
      membersThisWeek: new Set<string>(),
      name: row.axis_organizations.name,
      slug,
      weeklyCheckIns: 0,
    }
    const key = memberKey(row)

    group.weeklyCheckIns += 1
    group.dates.add(axisDateKey(new Date(row.occurred_at)))
    if (key) {
      const memberDates = group.memberDates.get(key) || new Set<string>()
      memberDates.add(axisDateKey(new Date(row.occurred_at)))
      group.memberDates.set(key, memberDates)
    }

    const occurredAt = new Date(row.occurred_at)

    if (occurredAt >= weekStart && key) {
      group.membersThisWeek.add(key)
    }

    if (occurredAt >= today) {
      if (key) group.membersToday.add(key)
      if (row.checked_out_at) group.completedToday += 1
      if (!row.checked_out_at) group.activeSessions += 1
    }

    if (isYesterday(row.occurred_at, today) && key) {
      group.membersYesterday.add(key)
    }

    groups.set(slug, group)
  }

  return Array.from(groups.values())
    .sort(
      (a, b) =>
        b.membersToday.size - a.membersToday.size ||
        b.weeklyCheckIns - a.weeklyCheckIns ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 4)
    .map((group) => {
      const streaksExtended = Array.from(group.membersToday).filter((key) =>
        group.membersYesterday.has(key)
      ).length
      const streakLeaderDays = Array.from(group.memberDates.values()).reduce(
        (leader, dates) => Math.max(leader, calculateDateSetStreak(dates)),
        0
      )

      return {
        activeSessions: group.activeSessions,
        avatar: group.avatar,
        detail: group.activeSessions
          ? `${group.activeSessions} active session${group.activeSessions === 1 ? "" : "s"}`
          : group.completedToday
            ? `${group.completedToday} completed`
            : `${streakLeaderDays} day top streak`,
        metric: group.membersToday.size
          ? `${group.membersToday.size} active today`
          : `${group.membersThisWeek.size} active this week`,
        name: group.name,
        signal: organizationCultureSignal(
          group.name,
          group.membersToday.size,
          group.membersThisWeek.size,
          streaksExtended,
          streakLeaderDays
        ),
        streakLeaderDays,
        slug: group.slug,
        weeklyMembers: group.membersThisWeek.size,
      }
    }) satisfies AxisOrganizationCulture[]
}

function organizationCultureSignal(
  name: string,
  activeToday: number,
  activeThisWeek: number,
  streaksExtended: number,
  streakLeaderDays: number
) {
  if (streaksExtended > 0) {
    return `${name} streak${streaksExtended === 1 ? "" : "s"} moving`
  }
  if (streakLeaderDays > 1) return `${name} - ${streakLeaderDays} day streak`
  if (activeToday > 0) return `${name} active today`
  if (activeThisWeek > 0) return `${name} building this week`

  return `${name} building this week`
}

function countOrganizations(rows: ParticipationCheckInRow[]) {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const name = row.axis_organizations?.name
    if (!name) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }

  return counts
}

function calculateDateSetStreak(days: Set<string>) {
  return activeContinuityStreak(days)
}
