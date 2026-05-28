import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { normalizeOrganizationSlug } from "@/lib/axis-orgs/organizations"
import { endSession } from "@/lib/axis-orgs/sessions"

export const runtime = "nodejs"

const ACTIVE_ORGANIZATIONS = new Set(["bridge", "city2city"])

type CheckOutBody = {
  sessionId?: unknown
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

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as CheckOutBody
  const saved = await endSession({
    organizationSlug,
    sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
    userId,
  })

  if ("error" in saved) {
    return NextResponse.json({ error: "Unable to end session." }, { status: 500 })
  }

  return NextResponse.json({
    duplicate: saved.duplicate,
    ok: true,
    session: saved.session,
  })
}
