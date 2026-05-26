import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisRequestIdentity } from "@/lib/axis-auth/identity"

export type AxisIdentityToken = {
  clerkUserId: string | null
  createdAt: string
  id: string
  label: string
  lastUsedAt: string | null
  organizationId: string | null
  status: string
  token: string
  tokenType: "nfc" | "qr"
  userId: string | null
}

export async function getOrCreateIdentityToken({
  identity,
  label = "Axis tag",
  organizationId = null,
  tokenType = "qr",
}: {
  identity: AxisRequestIdentity
  label?: string
  organizationId?: string | null
  tokenType?: "nfc" | "qr"
}) {
  const existing = await getIdentityTokenForOwner(identity, organizationId)
  if (existing) return existing

  const result = await supabaseAdmin
    .from("axis_identity_tokens")
    .insert({
      clerk_user_id: identity.clerkUserId,
      label,
      organization_id: organizationId,
      token: createTokenValue(),
      token_type: tokenType,
      user_id: identity.supabaseUserId,
    })
    .select(
      "id, token, token_type, organization_id, user_id, clerk_user_id, label, status, last_used_at, created_at"
    )
    .single<IdentityTokenRow>()

  if (result.error) return null

  return normalizeIdentityToken(result.data)
}

export async function getIdentityTokenForOwner(
  identity: AxisRequestIdentity,
  organizationId?: string | null
) {
  let query = supabaseAdmin
    .from("axis_identity_tokens")
    .select(
      "id, token, token_type, organization_id, user_id, clerk_user_id, label, status, last_used_at, created_at"
    )
    .eq("status", "active")
    .limit(1)

  query = identity.supabaseUserId
    ? query.eq("user_id", identity.supabaseUserId)
    : query.eq("clerk_user_id", identity.clerkUserId || "")

  query = organizationId
    ? query.eq("organization_id", organizationId)
    : query.is("organization_id", null)

  const result = await Promise.race([
    query.maybeSingle<IdentityTokenRow>(),
    timeoutTokenResult(2500),
  ])

  if (result.error || !result.data) return null

  return normalizeIdentityToken(result.data)
}

export async function getIdentityTokenByValue(token: string) {
  const result = await Promise.race([
    supabaseAdmin
      .from("axis_identity_tokens")
      .select(
        "id, token, token_type, organization_id, user_id, clerk_user_id, label, status, last_used_at, created_at"
      )
      .eq("token", normalizeTokenValue(token))
      .eq("status", "active")
      .maybeSingle<IdentityTokenRow>(),
    timeoutTokenResult(2500),
  ])

  if (result.error || !result.data) return null

  return normalizeIdentityToken(result.data)
}

export async function markIdentityTokenUsed(id: string) {
  await supabaseAdmin
    .from("axis_identity_tokens")
    .update({
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
}

function normalizeIdentityToken(row: IdentityTokenRow) {
  return {
    clerkUserId: row.clerk_user_id,
    createdAt: row.created_at,
    id: row.id,
    label: row.label,
    lastUsedAt: row.last_used_at,
    organizationId: row.organization_id,
    status: row.status,
    token: row.token,
    tokenType: row.token_type === "nfc" ? "nfc" : "qr",
    userId: row.user_id,
  } satisfies AxisIdentityToken
}

function createTokenValue() {
  return `axis_${crypto.randomUUID().replace(/-/g, "")}`
}

function normalizeTokenValue(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 96)
}

function timeoutTokenResult(milliseconds: number) {
  return new Promise<{
    data: null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Identity token lookup timed out"),
        }),
      milliseconds
    )
  })
}

type IdentityTokenRow = {
  clerk_user_id: string | null
  created_at: string
  id: string
  label: string
  last_used_at: string | null
  organization_id: string | null
  status: string
  token: string
  token_type: string
  user_id: string | null
}
