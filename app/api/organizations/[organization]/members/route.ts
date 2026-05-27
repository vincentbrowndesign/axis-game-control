import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
import {
  canManageOrganization,
  getOrganizationMembership,
  isAxisOrganizationRole,
  normalizeInviteCode,
} from "@/lib/axis-orgs/memberships"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type MembersRouteContext = {
  params: Promise<{
    organization: string
  }>
}

type MembersActionBody = {
  action?: unknown
  code?: unknown
  email?: unknown
  inviteId?: unknown
  membershipId?: unknown
  role?: unknown
}

export async function POST(request: Request, context: MembersRouteContext) {
  const traceId = crypto.randomUUID()
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json({ error: "SIGN IN REQUIRED", traceId }, { status: 401 })
  }

  const { organization: organizationSlug } = await context.params
  const organization = await getAxisOrganizationBySlug(organizationSlug)

  if (!organization?.id) {
    return NextResponse.json(
      { error: "ORGANIZATION NOT READY", traceId },
      { status: 409 }
    )
  }

  const membership = await getOrganizationMembership(organization.id, identity)

  if (!canManageOrganization(membership?.role)) {
    return NextResponse.json(
      { error: "ORGANIZATION ACCESS REQUIRED", traceId },
      { status: 403 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as MembersActionBody
  const action = typeof body.action === "string" ? body.action : ""

  if (action === "invite") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const requestedCode =
      typeof body.code === "string" ? normalizeInviteCode(body.code) : ""
    const role = isAxisOrganizationRole(body.role) ? body.role : "player"
    const inviteCode =
      requestedCode || defaultInviteCode(organization.slug, new Date().getFullYear())

    if (email && !email.includes("@")) {
      return NextResponse.json(
        { error: "VALID EMAIL OR BLANK REQUIRED", traceId },
        { status: 400 }
      )
    }

    if (!inviteCode || inviteCode.length < 4) {
      return NextResponse.json(
        { error: "VALID INVITE CODE REQUIRED", traceId },
        { status: 400 }
      )
    }

    const result = await supabaseAdmin
      .from("axis_organization_invites")
      .insert({
        email: email || null,
        invite_code: inviteCode,
        invited_by_clerk_user_id: identity.clerkUserId,
        invited_by_user_id: identity.supabaseUserId,
        organization_id: organization.id,
        role,
        status: "pending",
      })
      .select("id, invite_token, invite_code")
      .single<{ id: string; invite_code: string | null; invite_token: string }>()

    if (result.error) {
      return NextResponse.json(
        { detail: result.error.message, error: "INVITE NOT SAVED", traceId },
        { status: 500 }
      )
    }

    const code = result.data.invite_code || inviteCode

    return NextResponse.json({
      inviteCode: code,
      inviteId: result.data.id,
      joinCodePath: `/join/${organization.slug}/${code}`,
      joinPath: `/join/${result.data.invite_token}`,
      joinQueryPath: `/join?org=${organization.slug}&code=${code}`,
      ok: true,
      traceId,
    })
  }

  if (action === "assign-role") {
    const membershipId =
      typeof body.membershipId === "string" ? body.membershipId : ""
    const role = isAxisOrganizationRole(body.role) ? body.role : null

    if (!membershipId || !role) {
      return NextResponse.json(
        { error: "MEMBERSHIP AND ROLE REQUIRED", traceId },
        { status: 400 }
      )
    }

    const result = await supabaseAdmin
      .from("axis_organization_memberships")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", membershipId)
      .eq("organization_id", organization.id)
      .select("id")
      .single<{ id: string }>()

    if (result.error) {
      return NextResponse.json(
        { detail: result.error.message, error: "ROLE NOT SAVED", traceId },
        { status: 500 }
      )
    }

    return NextResponse.json({ membershipId: result.data.id, ok: true, traceId })
  }

  if (action === "remove") {
    const membershipId =
      typeof body.membershipId === "string" ? body.membershipId : ""

    if (!membershipId) {
      return NextResponse.json(
        { error: "MEMBERSHIP REQUIRED", traceId },
        { status: 400 }
      )
    }

    const result = await supabaseAdmin
      .from("axis_organization_memberships")
      .update({ status: "removed", updated_at: new Date().toISOString() })
      .eq("id", membershipId)
      .eq("organization_id", organization.id)
      .select("id")
      .single<{ id: string }>()

    if (result.error) {
      return NextResponse.json(
        { detail: result.error.message, error: "MEMBER NOT REMOVED", traceId },
        { status: 500 }
      )
    }

    return NextResponse.json({ membershipId: result.data.id, ok: true, traceId })
  }

  if (action === "disable-invite") {
    const inviteId = typeof body.inviteId === "string" ? body.inviteId : ""

    if (!inviteId) {
      return NextResponse.json(
        { error: "INVITE REQUIRED", traceId },
        { status: 400 }
      )
    }

    const result = await supabaseAdmin
      .from("axis_organization_invites")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", inviteId)
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .select("id")
      .single<{ id: string }>()

    if (result.error) {
      return NextResponse.json(
        { detail: result.error.message, error: "INVITE NOT DISABLED", traceId },
        { status: 500 }
      )
    }

    return NextResponse.json({ inviteId: result.data.id, ok: true, traceId })
  }

  return NextResponse.json({ error: "UNKNOWN ACTION", traceId }, { status: 400 })
}

function defaultInviteCode(slug: string, year: number) {
  const prefix =
    slug === "city2city"
      ? "CITY2CITY"
      : slug === "bridge"
        ? "BRIDGE"
        : normalizeInviteCode(slug)
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase()

  return normalizeInviteCode(`${prefix}${year}-${suffix}`)
}
