import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  ensureAxisOrganizationBySlug,
  normalizeOrganizationSlug,
} from "@/lib/axis-orgs/organizations"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const ACTIVE_V1_ORGANIZATIONS = new Set(["bridge", "city2city"])

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()

  try {
    const identity = await getAxisRequestIdentity()

    if (!identity?.clerkUserId && !identity?.supabaseUserId) {
      return NextResponse.json(
        { error: "Sign in to join.", ok: false, traceId },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const slug = normalizeOrganizationSlug(String(body.organization || ""))

    if (!ACTIVE_V1_ORGANIZATIONS.has(slug)) {
      return NextResponse.json(
        { error: "Choose Bridge or City 2 City.", ok: false, traceId },
        { status: 400 },
      )
    }

    const organization = await ensureAxisOrganizationBySlug(slug)

    if (!organization) {
      return NextResponse.json(
        { error: "Choose Bridge or City 2 City.", ok: false, traceId },
        { status: 400 },
      )
    }

    if (!organization.id) {
      return NextResponse.json(
        {
          error: "Organization could not be saved.",
          ok: false,
          traceId,
        },
        { status: 503 },
      )
    }

    let existingQuery = supabaseAdmin
      .from("axis_organization_memberships")
      .select("id, role, status")
      .eq("organization_id", organization.id)
      .limit(1)

    if (identity.supabaseUserId && identity.clerkUserId) {
      existingQuery = existingQuery.or(
        `user_id.eq.${identity.supabaseUserId},clerk_user_id.eq.${identity.clerkUserId}`,
      )
    } else {
      existingQuery = identity.supabaseUserId
        ? existingQuery.eq("user_id", identity.supabaseUserId)
        : existingQuery.eq("clerk_user_id", identity.clerkUserId || "")
    }

    const existing = await existingQuery.maybeSingle<{
      id: string
      role: string
      status: string
    }>()

    if (existing.error) {
      console.error("[axis:organizations:join:lookup]", {
        error: existing.error,
        traceId,
      })

      return NextResponse.json(
        {
          error: "Organization membership could not be checked.",
          ok: false,
          traceId,
        },
        { status: 500 },
      )
    }

    if (existing.data) {
      if (existing.data.status !== "active") {
        const reactivationPayload: Record<string, string | null> = {
          status: "active",
        }

        if (identity.clerkUserId) {
          reactivationPayload.clerk_user_id = identity.clerkUserId
        }

        if (identity.supabaseUserId) {
          reactivationPayload.user_id = identity.supabaseUserId
        }

        const reactivated = await supabaseAdmin
          .from("axis_organization_memberships")
          .update(reactivationPayload)
          .eq("id", existing.data.id)
          .select("id, role")
          .single<{ id: string; role: string }>()

        if (reactivated.error || !reactivated.data) {
          console.error("[axis:organizations:join:reactivate]", {
            error: reactivated.error,
            traceId,
          })

          return NextResponse.json(
            {
              error: "Organization membership could not be saved.",
              ok: false,
              traceId,
            },
            { status: 500 },
          )
        }

        return NextResponse.json({
          membershipId: reactivated.data.id,
          ok: true,
          organizationSlug: organization.slug,
          persisted: true,
          role: reactivated.data.role,
          traceId,
        })
      }

      return NextResponse.json({
        membershipId: existing.data.id,
        ok: true,
        organizationSlug: organization.slug,
        persisted: true,
        role: existing.data.role,
        traceId,
      })
    }

    const inserted = await supabaseAdmin
      .from("axis_organization_memberships")
      .insert({
        clerk_user_id: identity.clerkUserId,
        organization_id: organization.id,
        role: "player",
        status: "active",
        user_id: identity.supabaseUserId,
      })
      .select("id, role")
      .single<{ id: string; role: string }>()

    if (inserted.error || !inserted.data) {
      console.error("[axis:organizations:join:insert]", {
        error: inserted.error,
        traceId,
      })

      return NextResponse.json(
        {
          error: "Organization membership could not be saved.",
          ok: false,
          traceId,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      membershipId: inserted.data.id,
      ok: true,
      organizationSlug: organization.slug,
      persisted: true,
      role: inserted.data.role,
      traceId,
    })
  } catch (error) {
    console.error("[axis:organizations:join]", { error, traceId })

    return NextResponse.json(
      { error: "Unable to continue.", ok: false, traceId },
      { status: 500 },
    )
  }
}
