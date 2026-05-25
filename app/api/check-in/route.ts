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

export async function POST(request: Request) {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json(
      { error: "SIGN IN REQUIRED" },
      { status: 401 }
    )
  }

  const gym = readGymConfig()

  if (!gym) {
    return NextResponse.json(
      { error: "GYM BOUNDARY NOT CONFIGURED" },
      { status: 503 }
    )
  }

  let body: CheckInBody = {}

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const latitude = Number(body.latitude)
  const longitude = Number(body.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "LOCATION REQUIRED" },
      { status: 400 }
    )
  }

  const distanceMeters = distanceBetweenMeters(
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
        error: "OUTSIDE GYM RANGE",
      },
      { status: 403 }
    )
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

  const inserted = await supabaseAdmin
    .from("axis_training_check_ins")
    .insert({
      clerk_user_id: identity.clerkUserId,
      distance_meters: Math.round(distanceMeters),
      duration_minutes: durationMinutes,
      latitude,
      longitude,
      notes,
      user_id: identity.supabaseUserId,
      workout_type: workoutType,
    })
    .select("id, occurred_at")
    .single<{ id: string; occurred_at: string }>()

  if (inserted.error) {
    return NextResponse.json(
      { error: "CHECK IN NOT SAVED" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    checkIn: inserted.data,
    distanceMeters: Math.round(distanceMeters),
    ok: true,
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
