import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisRequestIdentity } from "@/lib/axis-auth/identity"

export type AxisTrainingCheckIn = {
  id: string
  status: string
  workout_type: string
  duration_minutes: number
  notes: string | null
  distance_meters: number
  occurred_at: string
}

export type AxisAttendanceSummary = {
  checkIns: AxisTrainingCheckIn[]
  streakDays: number
  totalMinutes: number
}

export type AxisPresenceCheckIn = {
  id: string
  clerk_user_id: string | null
  user_id: string | null
  workout_type: string
  occurred_at: string
}

export type AxisPresenceSummary = {
  checkedInToday: number
  recent: AxisPresenceCheckIn[]
}

export async function getAttendanceSummary(
  identity: AxisRequestIdentity,
  limit = 30
): Promise<AxisAttendanceSummary> {
  const emptySummary = {
    checkIns: [],
    streakDays: 0,
    totalMinutes: 0,
  }
  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select(
      "id, status, workout_type, duration_minutes, notes, distance_meters, occurred_at"
    )
    .order("occurred_at", { ascending: false })
    .limit(limit)

  query = identity.supabaseUserId
    ? query.eq("user_id", identity.supabaseUserId)
    : query.eq("clerk_user_id", identity.clerkUserId || "")

  const result = await Promise.race([
    query.returns<AxisTrainingCheckIn[]>(),
    timeoutResult(4500),
  ])

  if (result.error) {
    return emptySummary
  }

  const checkIns = result.data || []

  return {
    checkIns,
    streakDays: calculateStreak(checkIns),
    totalMinutes: checkIns.reduce(
      (total, checkIn) => total + checkIn.duration_minutes,
      0
    ),
  }
}

export async function getPresenceSummary(limit = 5): Promise<AxisPresenceSummary> {
  const emptySummary = {
    checkedInToday: 0,
    recent: [],
  }
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  const result = await Promise.race([
    loadPresenceSince(dayStart.toISOString(), limit),
    presenceTimeoutResult(3200),
  ])

  if (result.error) {
    return emptySummary
  }

  return {
    checkedInToday: result.count || 0,
    recent: result.data || [],
  }
}

async function loadPresenceSince(since: string, limit: number) {
  const [recentResult, countResult] = await Promise.all([
    supabaseAdmin
      .from("axis_training_check_ins")
      .select("id, clerk_user_id, user_id, workout_type, occurred_at")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(limit)
      .returns<AxisPresenceCheckIn[]>(),
    supabaseAdmin
      .from("axis_training_check_ins")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since),
  ])

  return {
    data: recentResult.data,
    count: countResult.count,
    error: recentResult.error || countResult.error,
  }
}

function timeoutResult(milliseconds: number) {
  return new Promise<{
    data: AxisTrainingCheckIn[] | null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Attendance memory timed out"),
        }),
      milliseconds
    )
  })
}

function presenceTimeoutResult(milliseconds: number) {
  return new Promise<{
    data: AxisPresenceCheckIn[] | null
    count: number | null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          count: null,
          error: new Error("Presence summary timed out"),
        }),
      milliseconds
    )
  })
}

export function calculateStreak(checkIns: AxisTrainingCheckIn[]) {
  const days = new Set(
    checkIns.map((checkIn) => toDateKey(new Date(checkIn.occurred_at)))
  )

  let streak = 0
  const cursor = new Date()

  while (days.has(toDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export function formatAttendanceDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value))
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}
