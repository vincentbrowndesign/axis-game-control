import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  ensureAxisOrganizationBySlug,
  normalizeOrganizationSlug,
} from "@/lib/axis-orgs/organizations"
import { ensureAxisPlayerMembership } from "@/lib/axis-orgs/memberships"

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

    const membership = await ensureAxisPlayerMembership(organization.id, identity)

    if (!membership) {
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
      membershipId: membership.id,
      ok: true,
      organizationSlug: organization.slug,
      persisted: true,
      role: membership.role,
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
