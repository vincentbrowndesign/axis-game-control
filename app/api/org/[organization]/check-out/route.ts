import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { completeCheckIn } from "@/lib/axis-orgs/check-ins"
import { normalizeOrganizationSlug } from "@/lib/axis-orgs/organizations"

export const runtime = "nodejs"

const ACTIVE_ORGANIZATIONS = new Set(["bridge", "city2city"])

type CheckOutBody = {
  workUnits?: unknown
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/[organization]/check-out">
) {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  }

  const { organization } = await context.params
  const organizationSlug = normalizeOrganizationSlug(organization)

  if (!ACTIVE_ORGANIZATIONS.has(organizationSlug)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 })
  }

  const userId = identity.clerkUserId || identity.supabaseUserId
  const body = (await request.json().catch(() => ({}))) as CheckOutBody

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  }

  const saved = await completeCheckIn({
    organizationSlug,
    userId,
    workUnits: body.workUnits,
  })

  if ("error" in saved) {
    console.error("AXIS END SESSION FAILED", {
      error: saved.error instanceof Error ? saved.error.message : saved.error,
      organizationSlug,
    })

    return NextResponse.json(
      { error: "Unable to end session." },
      { status: 500 }
    )
  }

  return NextResponse.json({
    checkIn: saved.checkIn,
    duplicate: saved.duplicate,
    ok: true,
  })
}
