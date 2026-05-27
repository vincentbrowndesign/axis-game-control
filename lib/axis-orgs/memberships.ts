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
import {
  activeContinuityStreak,
  axisDateKey,
  axisMonthKey,
  axisStartOfWeek,
  axisTodayRange,
} from "@/lib/axis-daily/continuity"

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

export type AxisMembershipWorld = AxisMembership & {
  organizationAvatar: string
  organizationId: string
  organizationName: string
  organizationSlug: string
}

export type AxisInvite = {
  createdAt: string
  email: string | null
  id: string
  inviteCode: string | null
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
  continuityMomentum: string
  mostActiveToday: string
  participationMovement: string
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

export type AxisOrganizationJoinSnapshot = {
  activeMembers: number
  activeStreaks: number
  checkedInToday: number
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

  query =
    identity.supabaseUserId && identity.clerkUserId
      ? query.or(
          `user_id.eq.${identity.supabaseUserId},clerk_user_id.eq.${identity.clerkUserId}`
        )
      : identity.supabaseUserId
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

export async function getAxisMembershipWorlds(identity: AxisRequestIdentity) {
  let query = supabaseAdmin
    .from("axis_organization_memberships")
    .select("id, organization_id, user_id, clerk_user_id, role, status, joined_at, created_at")
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .limit(12)

  query =
    identity.supabaseUserId && identity.clerkUserId
      ? query.or(
          `user_id.eq.${identity.supabaseUserId},clerk_user_id.eq.${identity.clerkUserId}`
        )
      : identity.supabaseUserId
        ? query.eq("user_id", identity.supabaseUserId)
        : query.eq("clerk_user_id", identity.clerkUserId || "")

  const membershipsResult = await Promise.race([
    query.returns<
      {
        clerk_user_id: string | null
        created_at: string
        id: string
        joined_at: string | null
        organization_id: string
        role: AxisOrganizationRole
        status: string
        user_id: string | null
      }[]
    >(),
    timeoutMembershipListResult(2500),
  ])

  const memberships = membershipsResult.data || []
  const organizationIds = memberships
    .map((membership) => membership.organization_id)
    .filter(Boolean)

  if (membershipsResult.error || !organizationIds.length) return []

  const organizationsResult = await Promise.race([
    supabaseAdmin
      .from("axis_organizations")
      .select("id, name, slug, avatar, logo")
      .in("id", organizationIds)
      .returns<
        {
          avatar: string | null
          id: string
          logo: string | null
          name: string
          slug: string
        }[]
      >(),
    timeoutListResult(2500),
  ])

  if (organizationsResult.error || !organizationsResult.data) return []

  const organizations = new Map(
    organizationsResult.data.map((organization) => [organization.id, organization])
  )

  return memberships.flatMap<AxisMembershipWorld>((membership) => {
    const organization = organizations.get(membership.organization_id)
    if (!organization) return []

    return {
      ...normalizeMembership(membership),
      organizationAvatar:
        organization.logo ||
        organization.avatar ||
        organization.name.slice(0, 2).toUpperCase(),
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
    }
  })
}

export async function ensureAxisPlayerMembership(
  organizationId: string,
  identity: AxisRequestIdentity
) {
  if (!identity.supabaseUserId && !identity.clerkUserId) return null

  let existingQuery = supabaseAdmin
    .from("axis_organization_memberships")
    .select("id, role, status")
    .eq("organization_id", organizationId)
    .limit(1)

  existingQuery =
    identity.supabaseUserId && identity.clerkUserId
      ? existingQuery.or(
          `user_id.eq.${identity.supabaseUserId},clerk_user_id.eq.${identity.clerkUserId}`
        )
      : identity.supabaseUserId
        ? existingQuery.eq("user_id", identity.supabaseUserId)
        : existingQuery.eq("clerk_user_id", identity.clerkUserId || "")

  const existing = await existingQuery.maybeSingle<{
    id: string
    role: AxisOrganizationRole
    status: string
  }>()

  if (existing.error) return null

  if (existing.data) {
    if (existing.data.status !== "active") {
      const reactivated = await supabaseAdmin
        .from("axis_organization_memberships")
        .update({ status: "active" })
        .eq("id", existing.data.id)
        .select("id, role")
        .single<{ id: string; role: AxisOrganizationRole }>()

      if (reactivated.error || !reactivated.data) return null

      return reactivated.data
    }

    return {
      id: existing.data.id,
      role: existing.data.role,
    }
  }

  const inserted = await supabaseAdmin
    .from("axis_organization_memberships")
    .insert({
      clerk_user_id: identity.clerkUserId,
      organization_id: organizationId,
      role: "player",
      status: "active",
      user_id: identity.supabaseUserId,
    })
    .select("id, role")
    .single<{ id: string; role: AxisOrganizationRole }>()

  if (!inserted.error && inserted.data) return inserted.data

  let retryQuery = supabaseAdmin
    .from("axis_organization_memberships")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)

  retryQuery =
    identity.supabaseUserId && identity.clerkUserId
      ? retryQuery.or(
          `user_id.eq.${identity.supabaseUserId},clerk_user_id.eq.${identity.clerkUserId}`
        )
      : identity.supabaseUserId
        ? retryQuery.eq("user_id", identity.supabaseUserId)
        : retryQuery.eq("clerk_user_id", identity.clerkUserId || "")

  const retry = await retryQuery.maybeSingle<{
    id: string
    role: AxisOrganizationRole
  }>()

  if (retry.error || !retry.data) return null

  return retry.data
}

export async function getOrganizationJoinSnapshot(organizationId: string) {
  const today = axisTodayRange()
  const since = new Date()
  since.setDate(since.getDate() - 60)

  const [membershipsResult, checkInsResult] = await Promise.all([
    Promise.race([
      supabaseAdmin
        .from("axis_organization_memberships")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .returns<{ id: string }[]>(),
      timeoutListResult(2500),
    ]),
    Promise.race([
      supabaseAdmin
        .from("axis_training_check_ins")
        .select("user_id, clerk_user_id, occurred_at")
        .eq("organization_id", organizationId)
        .eq("status", "checked_in")
        .gte("occurred_at", since.toISOString())
        .lt("occurred_at", today.end.toISOString())
        .returns<
          {
            clerk_user_id: string | null
            occurred_at: string
            user_id: string | null
          }[]
        >(),
      timeoutListResult(2500),
    ]),
  ])

  const checkIns = checkInsResult.error ? [] : checkInsResult.data || []
  const checkedInToday = new Set<string>()
  const daysByMember = new Map<string, Set<string>>()

  for (const checkIn of checkIns) {
    const key = checkIn.user_id || checkIn.clerk_user_id
    if (!key) continue

    const occurredAt = new Date(checkIn.occurred_at)
    const memberDays = daysByMember.get(key) || new Set<string>()
    memberDays.add(axisDateKey(occurredAt))
    daysByMember.set(key, memberDays)

    if (
      occurredAt >= today.start &&
      occurredAt < today.end
    ) {
      checkedInToday.add(key)
    }
  }

  return {
    activeMembers: membershipsResult.error
      ? 0
      : membershipsResult.data?.length || 0,
    activeStreaks: [...daysByMember.values()].filter(
      (days) => activeContinuityStreak(days) > 0
    ).length,
    checkedInToday: checkedInToday.size,
  } satisfies AxisOrganizationJoinSnapshot
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
  const weekStart = axisStartOfWeek(new Date())
  const todayKey = axisDateKey(new Date())
  const monthKey = axisMonthKey(new Date())
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

    if (axisDateKey(new Date(checkIn.occurred_at)) === todayKey) {
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

  const membershipByKey = new Map<string, AxisMembership>()

  for (const membership of memberships) {
    const key = membership.userId || membership.clerkUserId || ""
    if (key) membershipByKey.set(key, membership)
  }

  for (const checkIn of checkIns) {
    const key = checkIn.user_id || checkIn.clerk_user_id || ""

    if (!key || membershipByKey.has(key)) continue

    membershipByKey.set(key, {
      clerkUserId: checkIn.clerk_user_id,
      createdAt: checkIn.occurred_at,
      id: `activity-${key}`,
      joinedAt: checkIn.occurred_at,
      role: "player",
      status: "active",
      userId: checkIn.user_id,
    })
  }

  const members = [...membershipByKey.values()].map((membership) => {
    const key = membership.userId || membership.clerkUserId || ""
    const memberCheckIns = checkInsByMember.get(key) || []
    const dates = memberCheckIns.map((checkIn) => checkIn.occurred_at)
    const thisWeek = memberCheckIns.filter(
      (checkIn) => new Date(checkIn.occurred_at) >= weekStart
    )
    const monthDates = new Set(
      memberCheckIns
        .filter((checkIn) => axisMonthKey(new Date(checkIn.occurred_at)) === monthKey)
        .map((checkIn) => axisDateKey(new Date(checkIn.occurred_at)))
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
  const streaksExtendedToday = members.filter((member) => {
    const key = member.userId || member.clerkUserId || ""

    return activeToday.has(key) && member.streakDays > 1
  }).length
  const participationMovement = checkedInToday
    ? `${checkedInToday} check-in${checkedInToday === 1 ? "" : "s"} saved`
    : "No check-ins yet."
  const continuityMomentum = streaksExtendedToday
    ? `${streaksExtendedToday} streak${streaksExtendedToday === 1 ? "" : "s"} extended`
    : activeMembersThisWeek
      ? `${activeMembersThisWeek} active this week`
      : "Continuity begins after first check-in."

  return {
    activeMembersThisWeek,
    attendancePercent,
    dailyVisibility: {
      activeSessions: activeSessionsToday,
      activeToday: activeToday.size,
      checkedInToday,
      completedToday,
      continuityMomentum,
      mostActiveToday,
      participationMovement,
      topStreak: streakLeaders[0]
        ? `${memberLabel(streakLeaders[0])} - ${streakLeaders[0].streakDays} days`
        : "No check-ins yet",
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
        : "members can join from Axis entry",
      label: "active members",
      tone: activeMembersThisWeek ? "active" : "watch",
      value: `${members.length} total`,
    },
    {
      detail: completedToday
        ? `${completedToday} completed today`
        : "Waiting for first session.",
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
        ? "open join flow active"
        : "open join flow active",
      label: "onboarding",
      state: members.length || invites.length ? "active" : "ready",
      value: members.length
        ? `${members.length} member${members.length === 1 ? "" : "s"}`
        : "members choose org",
    },
    {
      detail: recentActivityCount
        ? "saved check-ins found"
        : "No check-ins yet.",
      label: "persistence",
      state: recentActivityCount ? "active" : "ready",
      value: recentActivityCount ? "history saving" : "0 saved",
    },
    {
      detail: completedToday
        ? `${completedToday} completed today`
        : "Waiting for first session.",
      label: "participation",
      state: checkedInToday ? "active" : "ready",
      value: checkedInToday
        ? `${checkedInToday} checked in`
        : "floor opening",
    },
    {
      detail: `${activeMembersThisWeek}/${members.length || 0} active this week`,
      label: "continuity",
      state: activeMembersThisWeek ? "active" : "ready",
      value: `${attendancePercent}% attendance`,
    },
    {
      detail: streakLeaders[0]
        ? `${streakLeaders[0].streakDays} day top streak`
        : "Continuity begins after first check-in.",
      label: "leaderboard",
      state: streakLeaders.length ? "active" : "ready",
      value: streakLeaders.length ? "ranking live" : "0 ranked",
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
      .select("id, invite_token, invite_code, email, role, status, created_at")
      .eq("organization_id", organizationId)
      .neq("status", "revoked")
      .order("created_at", { ascending: false })
      .returns<
        {
          created_at: string
          email: string | null
          id: string
          invite_code: string | null
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
    inviteCode: invite.invite_code,
    inviteToken: invite.invite_token,
    role: invite.role,
    status: invite.status,
  }))
}

export async function getOrganizationInviteByToken(token: string) {
  return getOrganizationInviteByIdentifier(token)
}

export async function getOrganizationInviteByCode(
  organizationSlug: string,
  code: string
) {
  return getOrganizationInviteByIdentifier(code, organizationSlug)
}

async function getOrganizationInviteByIdentifier(
  identifier: string,
  organizationSlug?: string
) {
  const normalizedCode = normalizeInviteCode(identifier)
  const normalizedSlug = organizationSlug
    ? organizationSlug.toLowerCase().replace(/[^a-z0-9-]/g, "")
    : ""
  const uuid = identifier.match(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  )?.[0]
  let query = supabaseAdmin
    .from("axis_organization_invites")
    .select(
      "id, invite_token, invite_code, email, role, status, organization_id, axis_organizations(id, name, slug, avatar, logo)"
    )
    .eq("status", "pending")

  query = uuid ? query.eq("invite_token", uuid) : query.eq("invite_code", normalizedCode)

  const result = await Promise.race([
    query.maybeSingle<{
        axis_organizations: {
          avatar: string | null
          id: string
          logo: string | null
          name: string
          slug: string
        } | null
        email: string | null
        id: string
        invite_code: string | null
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

  if (
    normalizedSlug &&
    result.data.axis_organizations.slug.toLowerCase() !== normalizedSlug
  ) {
    return null
  }

  return {
    email: result.data.email,
    id: result.data.id,
    inviteCode: result.data.invite_code,
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

export function normalizeInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40)
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
      value: mostConsistent ? memberLabel(mostConsistent) : "0 recorded",
    },
    {
      detail: completedToday
        ? `${completedToday} completed today`
        : "Waiting for first session.",
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
  const days = new Set(values.map((value) => axisDateKey(new Date(value))))

  return activeContinuityStreak(days)
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

  if (axisDateKey(date) === axisDateKey(today)) {
    return `today - ${formatAdminTime(value)}`
  }

  if (axisDateKey(date) === axisDateKey(yesterday)) {
    return `yesterday - ${formatAdminTime(value)}`
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
  }).format(date)
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

function timeoutMembershipListResult(milliseconds: number) {
  return new Promise<{
    data: []
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: [],
          error: new Error("Organization membership lookup timed out"),
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
