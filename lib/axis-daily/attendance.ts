import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisRequestIdentity } from "@/lib/axis-auth/identity"

export type AxisTrainingCheckIn = {
  checked_out_at: string | null
  id: string
  reflection: string | null
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

export async function getAttendanceSummary(
  identity: AxisRequestIdentity,
  limit = 30,
  organizationId?: string | null
): Promise<AxisAttendanceSummary> {
  const emptySummary = {
    checkIns: [],
    streakDays: 0,
    totalMinutes: 0,
  }
  let query = supabaseAdmin
    .from("axis_training_check_ins")
    .select(
      "id, status, workout_type, duration_minutes, notes, distance_meters, occurred_at, checked_out_at, reflection"
    )
    .order("occurred_at", { ascending: false })
    .limit(limit)

  query = identity.supabaseUserId
    ? query.eq("user_id", identity.supabaseUserId)
    : query.eq("clerk_user_id", identity.clerkUserId || "")

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

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

export async function getActiveTodayCount(organizationId?: string | null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let query = supabaseAdmin
      .from("axis_training_check_ins")
      .select("id", { count: "exact", head: true })
      .eq("status", "checked_in")
      .gte("occurred_at", today.toISOString())
      .lt("occurred_at", tomorrow.toISOString())

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const result = await Promise.race([
    query,
    timeoutCountResult(4500),
  ])

  if (result.error) {
    return 0
  }

  return result.count || 0
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

function timeoutCountResult(milliseconds: number) {
  return new Promise<{
    count: null
    data: null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          count: null,
          data: null,
          error: new Error("Attendance count timed out"),
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
