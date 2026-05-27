import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  completeSessionSegments,
  normalizeSessionSegments,
} from "@/lib/axis-daily/session-flow"
import { axisTodayRange } from "@/lib/axis-daily/continuity"
import { ensureAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type CheckOutBody = {
  organizationSlug?: unknown
  reflection?: unknown
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json({ error: "Sign in required", traceId }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as CheckOutBody
  const organization =
    typeof body.organizationSlug === "string" && body.organizationSlug.trim()
      ? await ensureAxisOrganizationBySlug(body.organizationSlug)
      : null
  const requestedOrganization =
    typeof body.organizationSlug === "string" && body.organizationSlug.trim()
      ? body.organizationSlug.trim()
      : ""

  if (requestedOrganization && !organization) {
    return NextResponse.json(
      { error: "Choose organization again", traceId },
      { status: 404 }
    )
  }

  const activeCheckIn = await findTodayCheckIn({
    clerkUserId: identity.clerkUserId,
    organizationId: organization?.id || null,
    supabaseUserId: identity.supabaseUserId,
  })

  if (!activeCheckIn) {
    return NextResponse.json(
      { error: "Check-in not found", traceId },
      { status: 404 }
    )
  }

  if (activeCheckIn.checked_out_at) {
    return NextResponse.json({
      checkIn: {
        ...activeCheckIn,
        session_segments: normalizeSessionSegments(activeCheckIn.session_segments),
      },
      duplicate: true,
      message: "History updated",
      ok: true,
      traceId,
    })
  }

  const checkedOutAt = new Date().toISOString()
  const reflection =
    typeof body.reflection === "string" && body.reflection.trim()
      ? body.reflection.trim().slice(0, 160)
      : null
  const result = await supabaseAdmin
    .from("axis_training_check_ins")
    .update({
      checked_out_at: checkedOutAt,
      reflection,
      session_segments: completeSessionSegments(
        normalizeSessionSegments(activeCheckIn.session_segments)
      ),
    })
    .eq("id", activeCheckIn.id)
    .select("id, occurred_at, checked_out_at, reflection, session_segments")
    .single<{
      checked_out_at: string | null
      id: string
      occurred_at: string
      reflection: string | null
      session_segments: unknown
    }>()

  if (result.error) {
    console.error("AXIS CHECK-OUT", {
      message: result.error.message,
      stage: "update-failed",
      traceId,
    })

    return NextResponse.json(
      { error: "Check-out failed", traceId },
      { status: 500 }
    )
  }

  return NextResponse.json({
    checkIn: {
      ...result.data,
      session_segments: normalizeSessionSegments(result.data.session_segments),
    },
    message: "History updated",
    ok: true,
    traceId,
  })
}

async function findTodayCheckIn({
  clerkUserId,
  organizationId,
  supabaseUserId,
}: {
  clerkUserId: string | null
  organizationId: string | null
  supabaseUserId: string | null
}) {
  const { end, start } = axisTodayRange()

  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select("id, occurred_at, checked_out_at, reflection, session_segments")
    .eq("status", "checked_in")
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(1)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  query =
    supabaseUserId && clerkUserId
      ? query.or(`user_id.eq.${supabaseUserId},clerk_user_id.eq.${clerkUserId}`)
      : supabaseUserId
        ? query.eq("user_id", supabaseUserId)
        : query.eq("clerk_user_id", clerkUserId || "")

  const result = await Promise.race([
    query.maybeSingle<{
      checked_out_at: string | null
      id: string
      occurred_at: string
      reflection: string | null
      session_segments: unknown
    }>(),
    new Promise<{
      data: null
      error: Error
    }>((resolve) => {
      setTimeout(
        () =>
          resolve({
            data: null,
            error: new Error("Check-out lookup timed out"),
          }),
        2500
      )
    }),
  ])

  if (result.error) return null

  return result.data
}
