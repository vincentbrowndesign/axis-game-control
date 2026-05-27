import {
  activeContinuityStreak,
  axisDateKey,
  axisStartOfWeek,
  axisTodayRange,
} from "@/lib/axis-daily/continuity"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type AxisCheckIn = {
  checked_in_at: string
  created_at: string
  id: string
  organization_slug: string
  user_id: string
}

export async function getTodayCheckIn({
  organizationSlug,
  userId,
}: {
  organizationSlug: string
  userId: string
}) {
  const { end, start } = axisTodayRange()

  const result = await supabaseAdmin
    .from("check_ins")
    .select("id, user_id, organization_slug, checked_in_at, created_at")
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .gte("checked_in_at", start.toISOString())
    .lt("checked_in_at", end.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle<AxisCheckIn>()

  if (result.error) {
    console.warn("AXIS TRAIN CHECK-IN", {
      detail: result.error.message,
      organizationSlug,
      stage: "today-read-failed",
    })

    return null
  }

  return result.data
}

export async function saveCheckIn({
  organizationSlug,
  userId,
}: {
  organizationSlug: string
  userId: string
}) {
  const existing = await getTodayCheckIn({ organizationSlug, userId })

  if (existing) {
    return {
      checkIn: existing,
      duplicate: true,
    }
  }

  const result = await supabaseAdmin
    .from("check_ins")
    .insert({
      organization_slug: organizationSlug,
      user_id: userId,
    })
    .select("id, user_id, organization_slug, checked_in_at, created_at")
    .single<AxisCheckIn>()

  if (result.error) {
    if (result.error.code === "23505") {
      const duplicate = await getTodayCheckIn({ organizationSlug, userId })

      if (duplicate) {
        return {
          checkIn: duplicate,
          duplicate: true,
        }
      }
    }

    console.error("AXIS TRAIN CHECK-IN", {
      code: result.error.code,
      detail: result.error.details,
      hint: result.error.hint,
      message: result.error.message,
      organizationSlug,
      stage: "insert-failed",
    })

    return {
      error: result.error,
    }
  }

  return {
    checkIn: result.data,
    duplicate: false,
  }
}

export async function getCheckInSummary({
  organizationSlug,
  userId,
}: {
  organizationSlug: string
  userId: string
}) {
  const result = await supabaseAdmin
    .from("check_ins")
    .select("id, user_id, organization_slug, checked_in_at, created_at")
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .order("checked_in_at", { ascending: false })
    .limit(365)
    .returns<AxisCheckIn[]>()

  if (result.error) {
    console.warn("AXIS TRAIN CHECK-IN", {
      detail: result.error.message,
      organizationSlug,
      stage: "summary-read-failed",
    })

    return emptyCheckInSummary()
  }

  return buildCheckInSummary(result.data || [])
}

export async function getOrganizationCheckInActivity(organizationSlug: string) {
  const result = await supabaseAdmin
    .from("check_ins")
    .select("id, user_id, organization_slug, checked_in_at, created_at")
    .eq("organization_slug", organizationSlug)
    .order("checked_in_at", { ascending: false })
    .limit(1000)
    .returns<AxisCheckIn[]>()

  if (result.error) {
    console.warn("AXIS COACH CHECK-INS", {
      detail: result.error.message,
      organizationSlug,
      stage: "activity-read-failed",
    })

    return emptyOrganizationCheckInActivity()
  }

  return buildOrganizationCheckInActivity(result.data || [])
}

function buildCheckInSummary(checkIns: AxisCheckIn[]) {
  const now = new Date()
  const { end: todayEnd, start: todayStart } = axisTodayRange(now)
  const weekStart = axisStartOfWeek(now)
  const days = new Set(checkIns.map((checkIn) => axisDateKey(new Date(checkIn.checked_in_at))))
  const todayCheckIn =
    checkIns.find((checkIn) => {
      const checkedInAt = new Date(checkIn.checked_in_at)

      return checkedInAt >= todayStart && checkedInAt < todayEnd
    }) || null
  const thisWeekCount = new Set(
    checkIns
      .filter((checkIn) => new Date(checkIn.checked_in_at) >= weekStart)
      .map((checkIn) => axisDateKey(new Date(checkIn.checked_in_at)))
  ).size

  return {
    currentStreak: activeContinuityStreak(days, now),
    history: checkIns.slice(0, 5),
    lastCheckIn: checkIns[0] || null,
    thisWeekCount,
    todayCheckIn,
  }
}

function emptyCheckInSummary() {
  return {
    currentStreak: 0,
    history: [] as AxisCheckIn[],
    lastCheckIn: null,
    thisWeekCount: 0,
    todayCheckIn: null,
  }
}

function buildOrganizationCheckInActivity(checkIns: AxisCheckIn[]) {
  const now = new Date()
  const { end: todayEnd, start: todayStart } = axisTodayRange(now)
  const weekStart = axisStartOfWeek(now)
  const todayCheckIns = checkIns.filter((checkIn) => {
    const checkedInAt = new Date(checkIn.checked_in_at)

    return checkedInAt >= todayStart && checkedInAt < todayEnd
  })
  const checkedInTodayByUser = newestByUser(todayCheckIns)
  const activeThisWeek = new Set(
    checkIns
      .filter((checkIn) => new Date(checkIn.checked_in_at) >= weekStart)
      .map((checkIn) => checkIn.user_id)
  )
  const checkInsByUser = groupCheckInsByUser(checkIns)
  const streakLeaders = Array.from(checkInsByUser.entries())
    .map(([userId, userCheckIns]) => {
      const days = new Set(
        userCheckIns.map((checkIn) => axisDateKey(new Date(checkIn.checked_in_at)))
      )

      return {
        streak: activeContinuityStreak(days, now),
        userId,
      }
    })
    .filter((leader) => leader.streak > 0)
    .sort((left, right) => right.streak - left.streak)
    .slice(0, 5)

  return {
    activeToday: checkedInTodayByUser.length,
    checkedInToday: checkedInTodayByUser,
    hasAnyCheckIns: checkIns.length > 0,
    streakLeaders,
    thisWeekActiveUsers: activeThisWeek.size,
  }
}

function emptyOrganizationCheckInActivity() {
  return {
    activeToday: 0,
    checkedInToday: [] as AxisCheckIn[],
    hasAnyCheckIns: false,
    streakLeaders: [] as Array<{ streak: number; userId: string }>,
    thisWeekActiveUsers: 0,
  }
}

function newestByUser(checkIns: AxisCheckIn[]) {
  return Array.from(groupCheckInsByUser(checkIns).values())
    .map((userCheckIns) => userCheckIns[0])
    .filter(Boolean)
}

function groupCheckInsByUser(checkIns: AxisCheckIn[]) {
  const grouped = new Map<string, AxisCheckIn[]>()

  for (const checkIn of checkIns) {
    const userCheckIns = grouped.get(checkIn.user_id) || []
    userCheckIns.push(checkIn)
    grouped.set(checkIn.user_id, userCheckIns)
  }

  return grouped
}
