import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { normalizeOrganizationSlug } from "@/lib/axis-orgs/organizations"
import { startSession } from "@/lib/axis-orgs/sessions"

export const runtime = "nodejs"

const ACTIVE_ORGANIZATIONS = new Set(["bridge", "city2city"])

export async function POST(
  _request: Request,
  context: RouteContext<"/api/org/[organization]/check-in">
) {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  }

  const { organization } = await context.params
  const organizationSlug = normalizeOrganizationSlug(organization)

  if (!ACTIVE_ORGANIZATIONS.has(organizationSlug)) {
    return NextResponse.json(
      { error: "Organization not found." },
      { status: 404 }
    )
  }

  const userId = identity.clerkUserId || identity.supabaseUserId

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  }

  const saved = await startSession({ organizationSlug, userId })

  if ("error" in saved) {
    return NextResponse.json({ error: "Unable to start session." }, { status: 500 })
  }

  return NextResponse.json({
    duplicate: saved.duplicate,
    ok: true,
    session: saved.session,
  })
}
