import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getOrCreateIdentityToken } from "@/lib/axis-daily/identity-tokens"
import { getAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"

export const runtime = "nodejs"

type IdentityTokenBody = {
  label?: unknown
  organizationSlug?: unknown
  tokenType?: unknown
}

export async function POST(request: Request) {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as IdentityTokenBody
  const organization =
    typeof body.organizationSlug === "string" && body.organizationSlug.trim()
      ? await getAxisOrganizationBySlug(body.organizationSlug)
      : null

  if (body.organizationSlug && !organization?.id) {
    return NextResponse.json(
      { error: "Organization not ready" },
      { status: 409 }
    )
  }

  const token = await getOrCreateIdentityToken({
    identity,
    label:
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 80)
        : "Axis tag",
    organizationId: organization?.id || null,
    tokenType: body.tokenType === "nfc" ? "nfc" : "qr",
  })

  if (!token) {
    return NextResponse.json(
      { error: "Unable to create identity token" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    token: {
      id: token.id,
      label: token.label,
      path: `/t/${token.token}`,
      tokenType: token.tokenType,
    },
  })
}
