import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  normalizeSessionSegments,
  type AxisSessionSegment,
} from "@/lib/axis-daily/session-flow"

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
  avatar: string
  detail: string
  metric: string
  name: string
  signal: string
  slug: string
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

  query = identity.supabaseUserId
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
    totalMinutes: checkIns.reduce(
      (total, checkIn) => total + checkIn.duration_minutes,
      0
    ),
  }
}

export async function getActiveTodayCount(organizationId?: string | null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let query = supabaseAdmin
      .from("axis_training_check_ins")
      .select("id", { count: "exact", head: true })
      .eq("status", "checked_in")
      .gte("occurred_at", today.toISOString())
      .lt("occurred_at", tomorrow.toISOString())

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const result = await Promise.race([
    query,
    timeoutCountResult(4500),
  ])

  if (result.error) {
    return 0
  }

  return result.count || 0
}

export async function getParticipationSignals(organizationId?: string | null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const since = new Date(today)
  since.setDate(today.getDate() - 7)

  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select(
      "id, user_id, clerk_user_id, organization_id, occurred_at, checked_out_at, axis_organizations(name, slug, avatar, logo)"
    )
    .eq("status", "checked_in")
    .gte("occurred_at", since.toISOString())
    .lt("occurred_at", tomorrow.toISOString())
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
  const todayRows = rows.filter((row) => new Date(row.occurred_at) >= today)
  const todayMembers = new Set(todayRows.map(memberKey).filter(Boolean))
  const yesterdayMembers = new Set(
    rows
      .filter((row) => isYesterday(row.occurred_at, today))
      .map(memberKey)
      .filter(Boolean)
  )
  const streaksExtendedToday = Array.from(todayMembers).filter((key) =>
    yesterdayMembers.has(key)
  ).length
  const completedToday = todayRows.filter((row) => row.checked_out_at).length
  const activeOrganizations = organizationActivity(todayRows)
  const leadingOrganization = leadingWeeklyOrganization(rows)
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
        label: "completed today",
        value: completedToday
          ? `${completedToday} completed session${completedToday === 1 ? "" : "s"}`
          : "sessions in motion",
      },
      {
        label: "streak movement",
        value: streaksExtendedToday
          ? `${streaksExtendedToday} streak${streaksExtendedToday === 1 ? "" : "s"} extended`
          : "streaks waiting",
      },
    ] satisfies AxisParticipationSignal[]
  }

  return [
    {
      label: "active today",
      value: todayMembers.size ? `${todayMembers.size} active today` : "floor opening",
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const since = new Date(today)
  since.setDate(today.getDate() - 7)

  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select(
      "id, user_id, clerk_user_id, organization_id, occurred_at, checked_out_at, axis_organizations(name, slug, avatar, logo)"
    )
    .eq("status", "checked_in")
    .gte("occurred_at", since.toISOString())
    .lt("occurred_at", tomorrow.toISOString())
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

  return buildOrganizationCulture(result.data || [], today)
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

function timeoutCountResult(milliseconds: number) {
  return new Promise<{
    count: null
    data: null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          count: null,
          data: null,
          error: new Error("Attendance count timed out"),
        }),
      milliseconds
    )
  })
}

export function calculateStreak(checkIns: AxisTrainingCheckIn[]) {
  const days = new Set(
    checkIns.map((checkIn) => toDateKey(new Date(checkIn.occurred_at)))
  )

  let streak = 0
  const cursor = new Date()

  while (days.has(toDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
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
      { label: "completed today", value: "sessions in motion" },
      { label: "streak movement", value: "streaks waiting" },
    ] satisfies AxisParticipationSignal[]
  }

  return [
    { label: "active today", value: "floor opening" },
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

  return toDateKey(date) === toDateKey(yesterday)
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

function buildOrganizationCulture(rows: ParticipationCheckInRow[], today: Date) {
  const groups = new Map<
    string,
    {
      avatar: string
      completedToday: number
      dates: Set<string>
      membersToday: Set<string>
      membersYesterday: Set<string>
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
      completedToday: 0,
      dates: new Set<string>(),
      membersToday: new Set<string>(),
      membersYesterday: new Set<string>(),
      name: row.axis_organizations.name,
      slug,
      weeklyCheckIns: 0,
    }
    const key = memberKey(row)

    group.weeklyCheckIns += 1
    group.dates.add(toDateKey(new Date(row.occurred_at)))

    if (new Date(row.occurred_at) >= today) {
      if (key) group.membersToday.add(key)
      if (row.checked_out_at) group.completedToday += 1
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

      return {
        avatar: group.avatar,
        detail: group.completedToday
          ? `${group.completedToday} completed`
          : `${group.dates.size} active day${group.dates.size === 1 ? "" : "s"}`,
        metric: group.membersToday.size
          ? `${group.membersToday.size} active today`
          : `${group.weeklyCheckIns} this week`,
        name: group.name,
        signal: organizationCultureSignal(group.name, group.membersToday.size, streaksExtended),
        slug: group.slug,
      }
    }) satisfies AxisOrganizationCulture[]
}

function organizationCultureSignal(
  name: string,
  activeToday: number,
  streaksExtended: number
) {
  if (streaksExtended > 0) {
    return `${name} streak${streaksExtended === 1 ? "" : "s"} moving`
  }
  if (activeToday > 0) return `${name} active today`

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

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}
