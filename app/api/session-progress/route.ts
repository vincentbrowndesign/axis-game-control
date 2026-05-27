import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  advanceSessionSegment,
  normalizeSessionSegments,
} from "@/lib/axis-daily/session-flow"
import { axisTodayRange } from "@/lib/axis-daily/continuity"
import { getAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type SessionProgressBody = {
  organizationSlug?: unknown
  segmentId?: unknown
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json({ error: "Sign in required", traceId }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as SessionProgressBody
  const segmentId = typeof body.segmentId === "string" ? body.segmentId : ""

  if (!segmentId) {
    return NextResponse.json(
      { error: "Session step missing", traceId },
      { status: 400 }
    )
  }

  const organization =
    typeof body.organizationSlug === "string" && body.organizationSlug.trim()
      ? await getAxisOrganizationBySlug(body.organizationSlug)
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
    return NextResponse.json(
      { error: "Session already completed", traceId },
      { status: 409 }
    )
  }

  const sessionSegments = advanceSessionSegment(
    normalizeSessionSegments(activeCheckIn.session_segments),
    segmentId
  )
  const result = await supabaseAdmin
    .from("axis_training_check_ins")
    .update({ session_segments: sessionSegments })
    .eq("id", activeCheckIn.id)
    .select("id, session_segments")
    .single<{
      id: string
      session_segments: unknown
    }>()

  if (result.error) {
    console.error("AXIS SESSION PROGRESS", {
      message: result.error.message,
      stage: "update-failed",
      traceId,
    })

    return NextResponse.json(
      { error: "Unable to update session", traceId },
      { status: 500 }
    )
  }

  return NextResponse.json({
    checkIn: {
      id: result.data.id,
      session_segments: normalizeSessionSegments(result.data.session_segments),
    },
    message: "Session updated",
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
    .select("id, checked_out_at, session_segments")
    .eq("status", "checked_in")
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(1)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  query = supabaseUserId
    ? query.eq("user_id", supabaseUserId)
    : query.eq("clerk_user_id", clerkUserId || "")

  const result = await Promise.race([
    query.maybeSingle<{
      checked_out_at: string | null
      id: string
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
            error: new Error("Session progress lookup timed out"),
          }),
        2500
      )
    }),
  ])

  if (result.error) return null

  return result.data
}
