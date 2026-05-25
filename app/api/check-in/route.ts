import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type CheckInBody = {
  latitude?: unknown
  longitude?: unknown
  workoutType?: unknown
  durationMinutes?: unknown
  notes?: unknown
}

function readGymConfig() {
  const latitude = Number(process.env.AXIS_GYM_LATITUDE)
  const longitude = Number(process.env.AXIS_GYM_LONGITUDE)
  const radiusMeters = Number(process.env.AXIS_GYM_RADIUS_METERS || 150)

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radiusMeters)
  ) {
    return null
  }

  return {
    latitude,
    longitude,
    radiusMeters,
  }
}

function requiresGymVerification() {
  return process.env.AXIS_REQUIRE_GYM_VERIFICATION === "true"
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    console.warn("AXIS CHECK-IN", {
      stage: "identity",
      status: "missing",
      traceId,
    })

    return NextResponse.json(
      { error: "SIGN IN REQUIRED", traceId },
      { status: 401 }
    )
  }

  let body: CheckInBody = {}

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const gymVerificationRequired = requiresGymVerification()
  const gym = gymVerificationRequired ? readGymConfig() : null
  const latitude = Number(body.latitude)
  const longitude = Number(body.longitude)
  const hasLocation =
    Number.isFinite(latitude) && Number.isFinite(longitude)
  let distanceMeters = 0

  if (gymVerificationRequired && !gym) {
    return NextResponse.json(
      { error: "CHECK IN VERIFICATION UNAVAILABLE", traceId },
      { status: 503 }
    )
  }

  if (gymVerificationRequired && !hasLocation) {
    return NextResponse.json(
      { error: "CHECK IN VERIFICATION REQUIRED", traceId },
      { status: 400 }
    )
  }

  if (gymVerificationRequired && gym && hasLocation) {
    distanceMeters = distanceBetweenMeters(
      latitude,
      longitude,
      gym.latitude,
      gym.longitude
    )

    if (distanceMeters > gym.radiusMeters) {
      return NextResponse.json(
        {
          denied: true,
          distanceMeters: Math.round(distanceMeters),
          error: "CHECK IN NOT VERIFIED",
          traceId,
        },
        { status: 403 }
      )
    }
  }

  const workoutType =
    typeof body.workoutType === "string" && body.workoutType.trim()
      ? body.workoutType.trim().slice(0, 80)
      : "Training"
  const durationMinutes = clampDuration(Number(body.durationMinutes))
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, 600)
      : null
  const insertPayload = {
    clerk_user_id: identity.clerkUserId,
    distance_meters: Math.round(distanceMeters),
    duration_minutes: durationMinutes,
    latitude: hasLocation ? latitude : 0,
    longitude: hasLocation ? longitude : 0,
    notes,
    status: "checked_in",
    user_id: identity.supabaseUserId,
    workout_type: workoutType,
  }

  console.info("AXIS CHECK-IN", {
    clerkUserId: identity.clerkUserId,
    hasLocation,
    hasSupabaseUserId: Boolean(identity.supabaseUserId),
    insertPayload: {
      clerk_user_id: insertPayload.clerk_user_id,
      distance_meters: insertPayload.distance_meters,
      duration_minutes: insertPayload.duration_minutes,
      latitude: insertPayload.latitude,
      longitude: insertPayload.longitude,
      status: insertPayload.status,
      user_id: insertPayload.user_id,
      workout_type: insertPayload.workout_type,
    },
    stage: "insert-start",
    table: "public.axis_training_check_ins",
    traceId,
    verification: gymVerificationRequired ? "gym_boundary" : "not_required",
  })

  const inserted = await supabaseAdmin
    .from("axis_training_check_ins")
    .insert(insertPayload)
    .select("id, occurred_at")
    .single<{ id: string; occurred_at: string }>()

  if (inserted.error) {
    console.error("AXIS CHECK-IN", {
      code: inserted.error.code,
      detail: inserted.error.details,
      hint: inserted.error.hint,
      message: inserted.error.message,
      stage: "insert-failed",
      traceId,
    })

    return NextResponse.json(
      {
        detail: inserted.error.message,
        error: "CHECK IN NOT SAVED",
        traceId,
      },
      { status: 500 }
    )
  }

  console.info("AXIS CHECK-IN", {
    checkInId: inserted.data.id,
    stage: "insert-complete",
    traceId,
  })

  return NextResponse.json({
    checkIn: inserted.data,
    distanceMeters: Math.round(distanceMeters),
    ok: true,
    traceId,
    verification: gymVerificationRequired ? "gym_boundary" : "not_required",
  })
}

function clampDuration(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(600, Math.round(value)))
}

function distanceBetweenMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) {
  const earthRadiusMeters = 6371000
  const deltaLatitude = toRadians(latitudeB - latitudeA)
  const deltaLongitude = toRadians(longitudeB - longitudeA)
  const startLatitude = toRadians(latitudeA)
  const endLatitude = toRadians(latitudeB)

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2)

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}
