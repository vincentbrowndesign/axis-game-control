import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  completedMinutesThisMonth,
  completedMinutesThisWeek,
  completedSessionMinutes,
  formatEffortHours,
  formatSessionDuration,
  totalCompletedMinutes,
} from "@/lib/axis-daily/duration"

export const AXIS_ORGANIZATION_ROLES = [
  "player",
  "coach",
  "admin",
  "organization_owner",
  "parent",
  "owner",
] as const

export type AxisOrganizationRole = (typeof AXIS_ORGANIZATION_ROLES)[number]

export type AxisMembership = {
  clerkUserId: string | null
  createdAt: string
  id: string
  joinedAt: string
  role: AxisOrganizationRole
  status: string
  userId: string | null
}

export type AxisInvite = {
  createdAt: string
  email: string
  id: string
  inviteToken: string
  role: AxisOrganizationRole
  status: string
}

export type AxisOrganizationSettings = {
  homeSessionsEnabled: boolean
  leaderboardEnabled: boolean
  locationVerificationEnabled: boolean
  nfcEnabled: boolean
  qrStationsEnabled: boolean
}

export type AxisMemberContinuity = AxisMembership & {
  activeDaysThisMonth: number
  checkIns: number
  checkInsThisWeek: number
  completedSessions: number
  completedThisWeek: number
  lastCheckIn: string | null
  lastCompletedSession: string | null
  lastCompletedSessionMinutes: number
  minutesThisMonth: number
  minutesThisWeek: number
  totalCompletedMinutes: number
  streakDays: number
}

export type AxisDailyVisibility = {
  activeSessions: number
  activeToday: number
  checkedInToday: number
  completedToday: number
  mostActiveToday: string
  topStreak: string
}

export type AxisOrganizationActivity = {
  detail: string
  id: string
  label: string
  occurredAt: string
  status: string
}

export type AxisOperationalTrustItem = {
  detail: string
  label: string
  state: "active" | "ready" | "waiting"
  value: string
}

export type AxisOrganizationOperatingItem = {
  detail: string
  label: string
  tone: "active" | "steady" | "watch"
  value: string
}

export type AxisSupportVisibilityItem = {
  detail: string
  label: string
  value: string
}

export type AxisOrganizationAdminModel = {
  activeMembersThisWeek: number
  attendancePercent: number
  dailyVisibility: AxisDailyVisibility
  invites: AxisInvite[]
  members: AxisMemberContinuity[]
  operatingSummary: AxisOrganizationOperatingItem[]
  participationContinuity: string
  recentActivity: AxisOrganizationActivity[]
  operationalTrust: AxisOperationalTrustItem[]
  settings: AxisOrganizationSettings
  streakLeaders: AxisMemberContinuity[]
  supportVisibility: AxisSupportVisibilityItem[]
}

const MANAGE_ROLES = new Set<AxisOrganizationRole>([
  "coach",
  "admin",
  "organization_owner",
  "owner",
])

export function canManageOrganization(role?: string | null) {
  return MANAGE_ROLES.has(role as AxisOrganizationRole)
}

export function isAxisOrganizationRole(value: unknown): value is AxisOrganizationRole {
  return (
    typeof value === "string" &&
    AXIS_ORGANIZATION_ROLES.includes(value as AxisOrganizationRole)
  )
}

export async function getOrganizationMembership(
  organizationId: string,
  identity: AxisRequestIdentity
) {
  let query = supabaseAdmin
    .from("axis_organization_memberships")
    .select("id, user_id, clerk_user_id, role, status, joined_at, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)

  query = identity.supabaseUserId
    ? query.eq("user_id", identity.supabaseUserId)
    : query.eq("clerk_user_id", identity.clerkUserId || "")

  const result = await Promise.race([
    query.maybeSingle<{
      clerk_user_id: string | null
      created_at: string
      id: string
      joined_at: string | null
      role: AxisOrganizationRole
      status: string
      user_id: string | null
    }>(),
    timeoutResult(2500),
  ])

  if (result.error || !result.data) return null

  return normalizeMembership(result.data)
}

export async function getOrganizationAdminModel(organizationId: string) {
  const [memberships, invites, checkIns, settings] = await Promise.all([
    readMemberships(organizationId),
    readInvites(organizationId),
    readCheckIns(organizationId),
    readSettings(organizationId),
  ])

  const checkInsByMember = new Map<string, AdminCheckInRow[]>()
  const checkInsTodayByMember = new Map<string, number>()
  const activeThisWeek = new Set<string>()
  const activeToday = new Set<string>()
  const weekStart = startOfWeek(new Date())
  const todayKey = toDateKey(new Date())
  const monthKey = toMonthKey(new Date())
  let checkedInToday = 0
  let completedToday = 0
  let activeSessionsToday = 0

  for (const checkIn of checkIns) {
    const key = checkIn.user_id || checkIn.clerk_user_id
    if (!key) continue

    const memberCheckIns = checkInsByMember.get(key) || []
    memberCheckIns.push(checkIn)
    checkInsByMember.set(key, memberCheckIns)

    if (new Date(checkIn.occurred_at) >= weekStart) {
      activeThisWeek.add(key)
    }

    if (toDateKey(new Date(checkIn.occurred_at)) === todayKey) {
      checkedInToday += 1
      activeToday.add(key)
      checkInsTodayByMember.set(key, (checkInsTodayByMember.get(key) || 0) + 1)

      if (checkIn.checked_out_at) {
        completedToday += 1
      } else {
        activeSessionsToday += 1
      }
    }
  }

  const members = memberships.map((membership) => {
    const key = membership.userId || membership.clerkUserId || ""
    const memberCheckIns = checkInsByMember.get(key) || []
    const dates = memberCheckIns.map((checkIn) => checkIn.occurred_at)
    const thisWeek = memberCheckIns.filter(
      (checkIn) => new Date(checkIn.occurred_at) >= weekStart
    )
    const monthDates = new Set(
      memberCheckIns
        .filter((checkIn) => toMonthKey(new Date(checkIn.occurred_at)) === monthKey)
        .map((checkIn) => toDateKey(new Date(checkIn.occurred_at)))
    )
    const completedSessions = memberCheckIns.filter(
      (checkIn) => checkIn.checked_out_at
    )
    const lastCompletedSession = completedSessions[0] || null

    return {
      ...membership,
      activeDaysThisMonth: monthDates.size,
      checkIns: dates.length,
      checkInsThisWeek: thisWeek.length,
      completedSessions: completedSessions.length,
      completedThisWeek: thisWeek.filter((checkIn) => checkIn.checked_out_at).length,
      lastCheckIn: dates[0] || null,
      lastCompletedSession: lastCompletedSession?.checked_out_at || null,
      lastCompletedSessionMinutes: lastCompletedSession
        ? completedSessionMinutes(lastCompletedSession)
        : 0,
      minutesThisMonth: completedMinutesThisMonth(memberCheckIns),
      minutesThisWeek: completedMinutesThisWeek(memberCheckIns),
      totalCompletedMinutes: totalCompletedMinutes(memberCheckIns),
      streakDays: calculateStreak(dates),
    }
  })
  const activeMembersThisWeek = members.filter((member) => {
    const key = member.userId || member.clerkUserId || ""

    return activeThisWeek.has(key)
  }).length
  const attendancePercent = members.length
    ? Math.round((activeMembersThisWeek / members.length) * 100)
    : 0
  const streakLeaders = [...members]
    .sort((a, b) => b.streakDays - a.streakDays || b.checkIns - a.checkIns)
    .slice(0, 3)
  const mostActiveToday = findMostActiveToday(members, checkInsTodayByMember)

  return {
    activeMembersThisWeek,
    attendancePercent,
    dailyVisibility: {
      activeSessions: activeSessionsToday,
      activeToday: activeToday.size,
      checkedInToday,
      completedToday,
      mostActiveToday,
      topStreak: streakLeaders[0]
        ? `${memberLabel(streakLeaders[0])} - ${streakLeaders[0].streakDays} days`
        : "No streak yet",
    },
    invites,
    members,
    operatingSummary: buildOperatingSummary({
      activeMembersThisWeek,
      attendancePercent,
      checkedInToday,
      completedToday,
      members,
      streakLeaders,
    }),
    operationalTrust: buildOperationalTrust({
      activeMembersThisWeek,
      attendancePercent,
      checkedInToday,
      completedToday,
      invites,
      members,
      recentActivityCount: checkIns.length,
      streakLeaders,
    }),
    participationContinuity: `${activeMembersThisWeek}/${members.length} active this week`,
    recentActivity: checkIns.slice(0, 6).map((checkIn, index) => {
      const member = members.find(
        (value) =>
          value.userId === checkIn.user_id ||
          value.clerkUserId === checkIn.clerk_user_id
      )

      return {
        detail: `${formatAdminTime(checkIn.occurred_at)}${
          checkIn.checked_out_at ? ` - completed ${formatAdminTime(checkIn.checked_out_at)}` : ""
        }`,
        id: `${checkIn.id || checkIn.occurred_at}-${index}`,
        label: member ? memberLabel(member) : fallbackMemberLabel(checkIn),
        occurredAt: checkIn.occurred_at,
        status: checkIn.checked_out_at ? "completed session" : "checked in",
      }
    }),
    settings,
    streakLeaders,
    supportVisibility: buildSupportVisibility({
      activeMembersThisWeek,
      completedToday,
      members,
    }),
  } satisfies AxisOrganizationAdminModel
}

function buildOperatingSummary({
  activeMembersThisWeek,
  attendancePercent,
  checkedInToday,
  completedToday,
  members,
  streakLeaders,
}: {
  activeMembersThisWeek: number
  attendancePercent: number
  checkedInToday: number
  completedToday: number
  members: AxisMemberContinuity[]
  streakLeaders: AxisMemberContinuity[]
}) {
  const completedThisWeek = members.reduce(
    (total, member) => total + member.completedThisWeek,
    0
  )
  const minutesThisWeek = members.reduce(
    (total, member) => total + member.minutesThisWeek,
    0
  )
  const activeStreaks = members.filter((member) => member.streakDays > 0).length
  const healthTone =
    attendancePercent >= 70 ? "active" : attendancePercent >= 35 ? "steady" : "watch"
  const healthLabel =
    attendancePercent >= 70 ? "strong" : attendancePercent >= 35 ? "building" : "warming up"

  return [
    {
      detail: activeMembersThisWeek
        ? `${activeMembersThisWeek} active this week`
        : "invite and check in members",
      label: "active members",
      tone: activeMembersThisWeek ? "active" : "watch",
      value: `${members.length} total`,
    },
    {
      detail: completedToday
        ? `${completedToday} completed today`
        : "completion loop ready",
      label: "session participation",
      tone: completedThisWeek ? "active" : checkedInToday ? "steady" : "watch",
      value: formatEffortHours(minutesThisWeek),
    },
    {
      detail: `${attendancePercent}% weekly attendance`,
      label: "continuity",
      tone: healthTone,
      value: healthLabel,
    },
    {
      detail: streakLeaders[0]
        ? `${memberLabel(streakLeaders[0])} leading`
        : "streaks start after check-ins",
      label: "streak systems",
      tone: activeStreaks ? "active" : "watch",
      value: `${activeStreaks} active`,
    },
    {
      detail: "culture health from participation",
      label: "participation health",
      tone: healthTone,
      value: `${attendancePercent}%`,
    },
  ] satisfies AxisOrganizationOperatingItem[]
}

type AdminCheckInRow = {
  checked_out_at: string | null
  clerk_user_id: string | null
  duration_minutes: number
  id: string
  occurred_at: string
  user_id: string | null
}

function buildOperationalTrust({
  activeMembersThisWeek,
  attendancePercent,
  checkedInToday,
  completedToday,
  invites,
  members,
  recentActivityCount,
  streakLeaders,
}: {
  activeMembersThisWeek: number
  attendancePercent: number
  checkedInToday: number
  completedToday: number
  invites: AxisInvite[]
  members: AxisMemberContinuity[]
  recentActivityCount: number
  streakLeaders: AxisMemberContinuity[]
}) {
  return [
    {
      detail: invites.length
        ? `${invites.length} invite${invites.length === 1 ? "" : "s"} waiting`
        : "join flow ready",
      label: "onboarding",
      state: members.length ? "active" : invites.length ? "ready" : "waiting",
      value: members.length
        ? `${members.length} member${members.length === 1 ? "" : "s"}`
        : "invite members",
    },
    {
      detail: recentActivityCount
        ? "saved check-ins found"
        : "first saved check-in waiting",
      label: "persistence",
      state: recentActivityCount ? "active" : "waiting",
      value: recentActivityCount ? "history saving" : "history empty",
    },
    {
      detail: completedToday
        ? `${completedToday} completed today`
        : "completion loop ready",
      label: "participation",
      state: checkedInToday ? "active" : "ready",
      value: checkedInToday
        ? `${checkedInToday} checked in`
        : "floor opening",
    },
    {
      detail: `${activeMembersThisWeek}/${members.length || 0} active this week`,
      label: "continuity",
      state: activeMembersThisWeek ? "active" : members.length ? "ready" : "waiting",
      value: `${attendancePercent}% attendance`,
    },
    {
      detail: streakLeaders[0]
        ? `${streakLeaders[0].streakDays} day top streak`
        : "rankings start after check-ins",
      label: "leaderboard",
      state: streakLeaders.length ? "active" : "waiting",
      value: streakLeaders.length ? "ranking live" : "board waiting",
    },
  ] satisfies AxisOperationalTrustItem[]
}

async function readMemberships(organizationId: string) {
  const result = await Promise.race([
    supabaseAdmin
      .from("axis_organization_memberships")
      .select("id, user_id, clerk_user_id, role, status, joined_at, created_at")
      .eq("organization_id", organizationId)
      .neq("status", "removed")
      .order("created_at", { ascending: true })
      .returns<
        {
          clerk_user_id: string | null
          created_at: string
          id: string
          joined_at: string | null
          role: AxisOrganizationRole
          status: string
          user_id: string | null
        }[]
      >(),
    timeoutListResult(3500),
  ])

  if (result.error) return []

  return (result.data || []).map(normalizeMembership)
}

async function readInvites(organizationId: string) {
  const result = await Promise.race([
    supabaseAdmin
      .from("axis_organization_invites")
      .select("id, invite_token, email, role, status, created_at")
      .eq("organization_id", organizationId)
      .neq("status", "revoked")
      .order("created_at", { ascending: false })
      .returns<
        {
          created_at: string
          email: string
          id: string
          invite_token: string
          role: AxisOrganizationRole
          status: string
        }[]
      >(),
    timeoutListResult(3500),
  ])

  if (result.error) return []

  return (result.data || []).map((invite) => ({
    createdAt: invite.created_at,
    email: invite.email,
    id: invite.id,
    inviteToken: invite.invite_token,
    role: invite.role,
    status: invite.status,
  }))
}

export async function getOrganizationInviteByToken(token: string) {
  const result = await Promise.race([
    supabaseAdmin
      .from("axis_organization_invites")
      .select(
        "id, invite_token, email, role, status, organization_id, axis_organizations(id, name, slug, avatar, logo)"
      )
      .eq("invite_token", token)
      .maybeSingle<{
        axis_organizations: {
          avatar: string | null
          id: string
          logo: string | null
          name: string
          slug: string
        } | null
        email: string
        id: string
        invite_token: string
        organization_id: string
        role: AxisOrganizationRole
        status: string
      }>(),
    timeoutResult(2500),
  ])

  if (result.error || !result.data || !result.data.axis_organizations) {
    return null
  }

  return {
    email: result.data.email,
    id: result.data.id,
    inviteToken: result.data.invite_token,
    organization: {
      avatar:
        result.data.axis_organizations.logo ||
        result.data.axis_organizations.avatar ||
        result.data.axis_organizations.name.slice(0, 2).toUpperCase(),
      id: result.data.axis_organizations.id,
      name: result.data.axis_organizations.name,
      slug: result.data.axis_organizations.slug,
    },
    organizationId: result.data.organization_id,
    role: result.data.role,
    status: result.data.status,
  }
}

async function readCheckIns(organizationId: string) {
  const result = await Promise.race([
    supabaseAdmin
      .from("axis_training_check_ins")
      .select("id, user_id, clerk_user_id, occurred_at, checked_out_at, duration_minutes")
      .eq("organization_id", organizationId)
      .eq("status", "checked_in")
      .order("occurred_at", { ascending: false })
      .limit(3000)
      .returns<AdminCheckInRow[]>(),
    timeoutListResult(3500),
  ])

  if (result.error) return []

  return result.data || []
}

function buildSupportVisibility({
  activeMembersThisWeek,
  completedToday,
  members,
}: {
  activeMembersThisWeek: number
  completedToday: number
  members: AxisMemberContinuity[]
}) {
  const completedThisWeek = members.reduce(
    (total, member) => total + member.completedThisWeek,
    0
  )
  const minutesThisWeek = members.reduce(
    (total, member) => total + member.minutesThisWeek,
    0
  )
  const minutesThisMonth = members.reduce(
    (total, member) => total + member.minutesThisMonth,
    0
  )
  const activeStreaks = members.filter((member) => member.streakDays > 0)
  const mostConsistent = [...members].sort(
    (a, b) =>
      b.activeDaysThisMonth - a.activeDaysThisMonth ||
      b.streakDays - a.streakDays ||
      b.checkIns - a.checkIns
  )[0]
  const lastCompleted = [...members]
    .filter((member) => member.lastCompletedSession)
    .sort(
      (a, b) =>
        new Date(b.lastCompletedSession || 0).getTime() -
        new Date(a.lastCompletedSession || 0).getTime()
    )[0]

  return [
    {
      detail: `${completedThisWeek} completed session${completedThisWeek === 1 ? "" : "s"}`,
      label: "completed this week",
      value: formatEffortHours(minutesThisWeek),
    },
    {
      detail: "completed effort this month",
      label: "hours this month",
      value: formatEffortHours(minutesThisMonth),
    },
    {
      detail: "consistency currently alive",
      label: "active streaks",
      value: `${activeStreaks.length} active`,
    },
    {
      detail: "members who showed up",
      label: "checked in this week",
      value: `${activeMembersThisWeek} member${activeMembersThisWeek === 1 ? "" : "s"}`,
    },
    {
      detail: mostConsistent
        ? `${mostConsistent.activeDaysThisMonth} active day${mostConsistent.activeDaysThisMonth === 1 ? "" : "s"} this month`
        : "no month record yet",
      label: "most consistent",
      value: mostConsistent ? memberLabel(mostConsistent) : "waiting",
    },
    {
      detail: completedToday
        ? `${completedToday} completed today`
        : "completion record waiting",
      label: "last completed",
      value: lastCompleted
        ? formatSessionDuration(lastCompleted.lastCompletedSessionMinutes)
        : "none yet",
    },
  ].slice(0, 5) satisfies AxisSupportVisibilityItem[]
}

async function readSettings(organizationId: string) {
  const result = await Promise.race([
    supabaseAdmin
      .from("axis_organizations")
      .select(
        "leaderboard_enabled, home_sessions_enabled, nfc_enabled, qr_stations_enabled, location_verification_enabled"
      )
      .eq("id", organizationId)
      .maybeSingle<{
        home_sessions_enabled: boolean
        leaderboard_enabled: boolean
        location_verification_enabled: boolean
        nfc_enabled: boolean
        qr_stations_enabled: boolean
      }>(),
    timeoutResult(2500),
  ])

  return {
    homeSessionsEnabled: Boolean(result.data?.home_sessions_enabled),
    leaderboardEnabled: result.data?.leaderboard_enabled !== false,
    locationVerificationEnabled: Boolean(result.data?.location_verification_enabled),
    nfcEnabled: Boolean(result.data?.nfc_enabled),
    qrStationsEnabled: Boolean(result.data?.qr_stations_enabled),
  }
}

function normalizeMembership(value: {
  clerk_user_id: string | null
  created_at: string
  id: string
  joined_at?: string | null
  role: AxisOrganizationRole
  status: string
  user_id: string | null
}) {
  return {
    clerkUserId: value.clerk_user_id,
    createdAt: value.created_at,
    id: value.id,
    joinedAt: value.joined_at || value.created_at,
    role: value.role,
    status: value.status,
    userId: value.user_id,
  } satisfies AxisMembership
}

function calculateStreak(values: string[]) {
  const days = new Set(values.map((value) => toDateKey(new Date(value))))
  let streak = 0
  const cursor = new Date()

  while (days.has(toDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function findMostActiveToday(
  members: AxisMemberContinuity[],
  checkInsTodayByMember: Map<string, number>
) {
  let activeMember: AxisMemberContinuity | null = null
  let activeCount = 0

  for (const member of members) {
    const key = member.userId || member.clerkUserId || ""
    const count = checkInsTodayByMember.get(key) || 0

    if (count > activeCount) {
      activeCount = count
      activeMember = member
    }
  }

  return activeMember ? `${memberLabel(activeMember)} - ${activeCount} today` : "No check-ins yet"
}

function memberLabel(member: AxisMembership) {
  const value = member.clerkUserId || member.userId || "member"
  const suffix = value.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()

  return suffix ? `MEMBER ${suffix}` : "MEMBER"
}

function fallbackMemberLabel(checkIn: {
  clerk_user_id: string | null
  user_id: string | null
}) {
  const value = checkIn.clerk_user_id || checkIn.user_id || "member"
  const suffix = value.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()

  return suffix ? `MEMBER ${suffix}` : "MEMBER"
}

function formatAdminTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatSupportDate(value: string) {
  if (!value) return "none yet"

  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (toDateKey(date) === toDateKey(today)) {
    return `today - ${formatAdminTime(value)}`
  }

  if (toDateKey(date) === toDateKey(yesterday)) {
    return `yesterday - ${formatAdminTime(value)}`
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
  }).format(date)
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
    data: null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Organization membership timed out"),
        }),
      milliseconds
    )
  })
}

function timeoutListResult(milliseconds: number) {
  return new Promise<{
    data: null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Organization list timed out"),
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
