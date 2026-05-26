import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  getOrganizationInviteByToken,
  isAxisOrganizationRole,
} from "@/lib/axis-orgs/memberships"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type AcceptInviteContext = {
  params: Promise<{
    token: string
  }>
}

export async function POST(_request: Request, context: AcceptInviteContext) {
  const traceId = crypto.randomUUID()
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json({ error: "SIGN IN REQUIRED", traceId }, { status: 401 })
  }

  const { token } = await context.params
  const invite = await getOrganizationInviteByToken(token)

  if (!invite || invite.status !== "pending") {
    return NextResponse.json(
      { error: "INVITE NOT AVAILABLE", traceId },
      { status: 404 }
    )
  }

  const role = isAxisOrganizationRole(invite.role) ? invite.role : "player"
  const membershipPayload = {
    clerk_user_id: identity.clerkUserId,
    joined_at: new Date().toISOString(),
    organization_id: invite.organizationId,
    role,
    status: "active",
    user_id: identity.supabaseUserId,
  }

  let existingQuery = supabaseAdmin
    .from("axis_organization_memberships")
    .select("id")
    .eq("organization_id", invite.organizationId)
    .limit(1)

  existingQuery = identity.supabaseUserId
    ? existingQuery.eq("user_id", identity.supabaseUserId)
    : existingQuery.eq("clerk_user_id", identity.clerkUserId || "")

  const existingMembership = await existingQuery.maybeSingle<{ id: string }>()
  const membership = existingMembership.data
    ? await supabaseAdmin
        .from("axis_organization_memberships")
        .update({
          role,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.data.id)
        .select("id")
        .single<{ id: string }>()
    : await supabaseAdmin
        .from("axis_organization_memberships")
        .insert(membershipPayload)
        .select("id")
        .single<{ id: string }>()

  if (membership.error) {
    return NextResponse.json(
      {
        detail: membership.error.message,
        error: "MEMBERSHIP NOT SAVED",
        traceId,
      },
      { status: 500 }
    )
  }

  await supabaseAdmin
    .from("axis_organization_invites")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by_clerk_user_id: identity.clerkUserId,
      accepted_by_user_id: identity.supabaseUserId,
      status: "accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id)

  return NextResponse.json({
    membershipId: membership.data.id,
    ok: true,
    organizationSlug: invite.organization.slug,
    traceId,
  })
}
