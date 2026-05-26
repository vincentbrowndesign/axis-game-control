import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
import {
  canManageOrganization,
  getOrganizationMembership,
} from "@/lib/axis-orgs/memberships"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type SettingsRouteContext = {
  params: Promise<{
    organization: string
  }>
}

const SETTING_KEYS = {
  homeSessionsEnabled: "home_sessions_enabled",
  leaderboardEnabled: "leaderboard_enabled",
  locationVerificationEnabled: "location_verification_enabled",
  nfcEnabled: "nfc_enabled",
  qrStationsEnabled: "qr_stations_enabled",
} as const

export async function POST(request: Request, context: SettingsRouteContext) {
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

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, boolean | string> = {
    updated_at: new Date().toISOString(),
  }

  for (const [bodyKey, column] of Object.entries(SETTING_KEYS)) {
    if (typeof body[bodyKey] === "boolean") {
      updates[column] = body[bodyKey]
    }
  }

  const result = await supabaseAdmin
    .from("axis_organizations")
    .update(updates)
    .eq("id", organization.id)
    .select("id")
    .single<{ id: string }>()

  if (result.error) {
    return NextResponse.json(
      { detail: result.error.message, error: "SETTINGS NOT SAVED", traceId },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, organizationId: result.data.id, traceId })
}
