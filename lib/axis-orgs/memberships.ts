import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisRequestIdentity } from "@/lib/axis-auth/identity"

export const AXIS_ORGANIZATION_ROLES = [
  "player",
  "coach",
  "admin",
  "parent",
  "owner",
] as const

export type AxisOrganizationRole = (typeof AXIS_ORGANIZATION_ROLES)[number]

export type AxisMembership = {
  clerkUserId: string | null
  createdAt: string
  id: string
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
  checkIns: number
  lastCheckIn: string | null
  streakDays: number
}

export type AxisOrganizationAdminModel = {
  activeMembersThisWeek: number
  attendancePercent: number
  invites: AxisInvite[]
  members: AxisMemberContinuity[]
  participationContinuity: string
  settings: AxisOrganizationSettings
  streakLeaders: AxisMemberContinuity[]
}

const MANAGE_ROLES = new Set<AxisOrganizationRole>(["coach", "admin", "owner"])

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
    .select("id, user_id, clerk_user_id, role, status, created_at")
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

  const checkInsByMember = new Map<string, string[]>()
  const activeThisWeek = new Set<string>()
  const weekStart = startOfWeek(new Date())

  for (const checkIn of checkIns) {
    const key = checkIn.user_id || checkIn.clerk_user_id
    if (!key) continue

    const dates = checkInsByMember.get(key) || []
    dates.push(checkIn.occurred_at)
    checkInsByMember.set(key, dates)

    if (new Date(checkIn.occurred_at) >= weekStart) {
      activeThisWeek.add(key)
    }
  }

  const members = memberships.map((membership) => {
    const key = membership.userId || membership.clerkUserId || ""
    const dates = checkInsByMember.get(key) || []

    return {
      ...membership,
      checkIns: dates.length,
      lastCheckIn: dates[0] || null,
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

  return {
    activeMembersThisWeek,
    attendancePercent,
    invites,
    members,
    participationContinuity: `${activeMembersThisWeek}/${members.length} active this week`,
    settings,
    streakLeaders: [...members]
      .sort((a, b) => b.streakDays - a.streakDays || b.checkIns - a.checkIns)
      .slice(0, 3),
  } satisfies AxisOrganizationAdminModel
}

async function readMemberships(organizationId: string) {
  const result = await Promise.race([
    supabaseAdmin
      .from("axis_organization_memberships")
      .select("id, user_id, clerk_user_id, role, status, created_at")
      .eq("organization_id", organizationId)
      .neq("status", "removed")
      .order("created_at", { ascending: true })
      .returns<
        {
          clerk_user_id: string | null
          created_at: string
          id: string
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
        "id, invite_token, email, role, status, organization_id, axis_organizations(id, name, slug, avatar)"
      )
      .eq("invite_token", token)
      .maybeSingle<{
        axis_organizations: {
          avatar: string | null
          id: string
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
      .select("user_id, clerk_user_id, occurred_at")
      .eq("organization_id", organizationId)
      .eq("status", "checked_in")
      .order("occurred_at", { ascending: false })
      .limit(3000)
      .returns<
        {
          clerk_user_id: string | null
          occurred_at: string
          user_id: string | null
        }[]
      >(),
    timeoutListResult(3500),
  ])

  if (result.error) return []

  return result.data || []
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
  role: AxisOrganizationRole
  status: string
  user_id: string | null
}) {
  return {
    clerkUserId: value.clerk_user_id,
    createdAt: value.created_at,
    id: value.id,
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
