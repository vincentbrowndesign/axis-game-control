import { AXIS_DEFAULT_SESSION_SEGMENTS } from "@/lib/axis-daily/session-flow"
import type { AxisIdentityToken } from "@/lib/axis-daily/identity-tokens"
import { markIdentityTokenUsed } from "@/lib/axis-daily/identity-tokens"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function checkInWithIdentityToken(token: AxisIdentityToken) {
  const existing = await findExistingTokenCheckIn(token)

  if (existing) {
    await markIdentityTokenUsed(token.id)
    return {
      checkIn: existing,
      duplicate: true,
      ok: true,
    }
  }

  const result = await supabaseAdmin
    .from("axis_training_check_ins")
    .insert({
      clerk_user_id: token.clerkUserId,
      distance_meters: 0,
      duration_minutes: 60,
      identity_token_id: token.id,
      latitude: 0,
      longitude: 0,
      notes: "Identity token",
      organization_id: token.organizationId,
      session_segments: AXIS_DEFAULT_SESSION_SEGMENTS,
      status: "checked_in",
      user_id: token.userId,
      workout_type: "Open Gym",
    })
    .select("id, occurred_at")
    .single<{
      id: string
      occurred_at: string
    }>()

  if (result.error) {
    return {
      error: result.error.message,
      ok: false,
    }
  }

  await markIdentityTokenUsed(token.id)

  return {
    checkIn: result.data,
    duplicate: false,
    ok: true,
  }
}

async function findExistingTokenCheckIn(token: AxisIdentityToken) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select("id, occurred_at")
    .eq("status", "checked_in")
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(1)

  if (token.organizationId) {
    query = query.eq("organization_id", token.organizationId)
  }

  query = token.userId
    ? query.eq("user_id", token.userId)
    : query.eq("clerk_user_id", token.clerkUserId || "")

  const result = await Promise.race([
    query.maybeSingle<{
      id: string
      occurred_at: string
    }>(),
    new Promise<{
      data: null
      error: Error
    }>((resolve) => {
      setTimeout(
        () =>
          resolve({
            data: null,
            error: new Error("Token check-in lookup timed out"),
          }),
        2500
      )
    }),
  ])

  if (result.error) return null

  return result.data
}
