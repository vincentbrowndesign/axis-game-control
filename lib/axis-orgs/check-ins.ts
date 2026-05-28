import {
  activeContinuityStreak,
  axisDateKey,
  axisStartOfWeek,
  axisTodayRange,
} from "@/lib/axis-daily/continuity"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type AxisCheckIn = {
  checked_in_at: string
  checked_out_at: string | null
  created_at: string
  duration_minutes: number
  id: string
  organization_slug: string
  user_id: string
  work_units: AxisWorkUnit[]
}

export type AxisWorkUnit = {
  completed: boolean
  duration_minutes: number
  makes: number
  name: string
  reps: number
  sets: number
}

const CHECK_IN_SELECT_BASE =
  "id, user_id, organization_slug, checked_in_at, checked_out_at, duration_minutes, created_at"
const CHECK_IN_SELECT_WITH_WORK =
  "id, user_id, organization_slug, checked_in_at, checked_out_at, duration_minutes, work_units, created_at"
let workUnitsColumnAvailable: boolean | null = null

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
    .select(checkInSelect())
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .gte("checked_in_at", start.toISOString())
    .lt("checked_in_at", end.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle<RawAxisCheckIn>()

  if (result.error) {
    if (isMissingWorkUnitsError(result.error)) {
      rememberMissingWorkUnitsColumn({ organizationSlug, stage: "today-read-fallback" })

      const fallback = await supabaseAdmin
        .from("check_ins")
        .select(CHECK_IN_SELECT_BASE)
        .eq("user_id", userId)
        .eq("organization_slug", organizationSlug)
        .gte("checked_in_at", start.toISOString())
        .lt("checked_in_at", end.toISOString())
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle<RawAxisCheckIn>()

      if (!fallback.error) {
        return fallback.data ? normalizeCheckIn(fallback.data) : null
      }
    } else {
      workUnitsColumnAvailable = true
    }

    console.warn("AXIS TRAIN CHECK-IN", {
      code: result.error.code,
      detail: result.error.message,
      hint: result.error.hint,
      organizationSlug,
      stage: "today-read-failed",
    })

    return null
  }

  if (workUnitsColumnAvailable !== false) {
    workUnitsColumnAvailable = true
  }

  return result.data ? normalizeCheckIn(result.data) : null
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
    .select(checkInSelect())
    .single<RawAxisCheckIn>()

  if (result.error) {
    if (isMissingWorkUnitsError(result.error)) {
      rememberMissingWorkUnitsColumn({ organizationSlug, stage: "insert-select-fallback" })

      const savedWithoutWork = await getTodayCheckIn({ organizationSlug, userId })

      if (savedWithoutWork) {
        return {
          checkIn: savedWithoutWork,
          duplicate: false,
        }
      }
    } else {
      workUnitsColumnAvailable = true
    }

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

  if (workUnitsColumnAvailable !== false) {
    workUnitsColumnAvailable = true
  }

  return {
    checkIn: normalizeCheckIn(result.data),
    duplicate: false,
  }
}

export async function completeCheckIn({
  organizationSlug,
  userId,
  workUnits = [],
}: {
  organizationSlug: string
  userId: string
  workUnits?: unknown
}) {
  const existing = await getTodayCheckIn({ organizationSlug, userId })

  if (!existing) {
    return {
      error: new Error("Session not found"),
    }
  }

  if (existing.checked_out_at) {
    return {
      checkIn: existing,
      duplicate: true,
    }
  }

  const checkedOutAt = new Date().toISOString()
  const durationMinutes = completedSessionMinutes({
    checkedInAt: existing.checked_in_at,
    checkedOutAt,
  })
  const result = await supabaseAdmin
    .from("check_ins")
    .update({
      checked_out_at: checkedOutAt,
      duration_minutes: durationMinutes,
      ...(workUnitsColumnAvailable === false
        ? {}
        : { work_units: normalizeWorkUnits(workUnits) }),
    })
    .eq("id", existing.id)
    .select(checkInSelect())
    .single<RawAxisCheckIn>()

  if (result.error) {
    if (isMissingWorkUnitsError(result.error)) {
      rememberMissingWorkUnitsColumn({ organizationSlug, stage: "check-out-fallback" })

      const fallback = await supabaseAdmin
        .from("check_ins")
        .update({
          checked_out_at: checkedOutAt,
          duration_minutes: durationMinutes,
        })
        .eq("id", existing.id)
        .select(CHECK_IN_SELECT_BASE)
        .single<RawAxisCheckIn>()

      if (!fallback.error) {
        return {
          checkIn: normalizeCheckIn(fallback.data),
          duplicate: false,
        }
      }
    } else {
      workUnitsColumnAvailable = true
    }

    console.error("AXIS TRAIN CHECK-OUT", {
      code: result.error.code,
      detail: result.error.details,
      hint: result.error.hint,
      message: result.error.message,
      organizationSlug,
      stage: "update-failed",
    })

    return {
      error: result.error,
    }
  }

  if (workUnitsColumnAvailable !== false) {
    workUnitsColumnAvailable = true
  }

  return {
    checkIn: normalizeCheckIn(result.data),
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
    .select(checkInSelect())
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .order("checked_in_at", { ascending: false })
    .limit(365)
    .returns<RawAxisCheckIn[]>()

  if (result.error) {
    if (isMissingWorkUnitsError(result.error)) {
      rememberMissingWorkUnitsColumn({ organizationSlug, stage: "summary-read-fallback" })

      const fallback = await supabaseAdmin
        .from("check_ins")
        .select(CHECK_IN_SELECT_BASE)
        .eq("user_id", userId)
        .eq("organization_slug", organizationSlug)
        .order("checked_in_at", { ascending: false })
        .limit(365)
        .returns<RawAxisCheckIn[]>()

      if (!fallback.error) {
        return buildCheckInSummary((fallback.data || []).map(normalizeCheckIn))
      }
    } else {
      workUnitsColumnAvailable = true
    }

    console.warn("AXIS TRAIN CHECK-IN", {
      code: result.error.code,
      detail: result.error.message,
      hint: result.error.hint,
      organizationSlug,
      stage: "summary-read-failed",
    })

    return emptyCheckInSummary()
  }

  if (workUnitsColumnAvailable !== false) {
    workUnitsColumnAvailable = true
  }

  return buildCheckInSummary((result.data || []).map(normalizeCheckIn))
}

export async function getOrganizationCheckInActivity(organizationSlug: string) {
  const result = await supabaseAdmin
    .from("check_ins")
    .select(checkInSelect())
    .eq("organization_slug", organizationSlug)
    .order("checked_in_at", { ascending: false })
    .limit(1000)
    .returns<RawAxisCheckIn[]>()

  if (result.error) {
    if (isMissingWorkUnitsError(result.error)) {
      rememberMissingWorkUnitsColumn({ organizationSlug, stage: "activity-read-fallback" })

      const fallback = await supabaseAdmin
        .from("check_ins")
        .select(CHECK_IN_SELECT_BASE)
        .eq("organization_slug", organizationSlug)
        .order("checked_in_at", { ascending: false })
        .limit(1000)
        .returns<RawAxisCheckIn[]>()

      if (!fallback.error) {
        return buildOrganizationCheckInActivity(
          (fallback.data || []).map(normalizeCheckIn)
        )
      }
    } else {
      workUnitsColumnAvailable = true
    }

    console.warn("AXIS COACH CHECK-INS", {
      code: result.error.code,
      detail: result.error.message,
      hint: result.error.hint,
      organizationSlug,
      stage: "activity-read-failed",
    })

    return emptyOrganizationCheckInActivity()
  }

  if (workUnitsColumnAvailable !== false) {
    workUnitsColumnAvailable = true
  }

  return buildOrganizationCheckInActivity((result.data || []).map(normalizeCheckIn))
}

type RawAxisCheckIn = Omit<AxisCheckIn, "work_units"> & {
  work_units?: unknown
}

function checkInSelect() {
  return workUnitsColumnAvailable === false
    ? CHECK_IN_SELECT_BASE
    : CHECK_IN_SELECT_WITH_WORK
}

function isMissingWorkUnitsError(error: {
  code?: string
  message?: string
}) {
  return (
    error.code === "PGRST204" ||
    Boolean(error.message?.toLowerCase().includes("work_units"))
  )
}

function rememberMissingWorkUnitsColumn({
  organizationSlug,
  stage,
}: {
  organizationSlug: string
  stage: string
}) {
  workUnitsColumnAvailable = false
  console.warn("AXIS TRAIN CHECK-IN", {
    detail: "work_units column unavailable; continuing without work unit storage",
    organizationSlug,
    stage,
  })
}

export function normalizeWorkUnits(value: unknown): AxisWorkUnit[] {
  if (!Array.isArray(value)) return []

  return value
    .map((unit) => {
      if (!unit || typeof unit !== "object") return null

      const record = unit as Record<string, unknown>
      const name = typeof record.name === "string" ? record.name.trim() : ""

      if (!name) return null

      return {
        completed: Boolean(record.completed),
        duration_minutes: cleanWorkNumber(record.duration_minutes),
        makes: cleanWorkNumber(record.makes),
        name: name.slice(0, 40),
        reps: cleanWorkNumber(record.reps),
        sets: cleanWorkNumber(record.sets),
      }
    })
    .filter((unit): unit is AxisWorkUnit => Boolean(unit))
    .slice(0, 12)
}

function normalizeCheckIn(row: RawAxisCheckIn): AxisCheckIn {
  return {
    ...row,
    work_units: normalizeWorkUnits(row.work_units),
  }
}

function completedSessionMinutes({
  checkedInAt,
  checkedOutAt,
}: {
  checkedInAt: string
  checkedOutAt: string
}) {
  const startedAt = new Date(checkedInAt).getTime()
  const endedAt = new Date(checkedOutAt).getTime()
  const diffMinutes = Math.round((endedAt - startedAt) / 60000)

  if (!Number.isFinite(diffMinutes)) return 0

  return Math.max(0, Math.min(diffMinutes, 600))
}

function cleanWorkNumber(value: unknown) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(Math.round(number), 10000))
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
  const activeSessions = todayCheckIns.filter((checkIn) => !checkIn.checked_out_at).length
  const completedToday = todayCheckIns.filter((checkIn) => checkIn.checked_out_at).length
  const workCompletedToday = todayCheckIns.reduce(
    (total, checkIn) =>
      total + checkIn.work_units.filter((unit) => unit.completed).length,
    0
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
  const mostActive = Array.from(checkInsByUser.entries())
    .map(([userId, userCheckIns]) => ({
      userId,
      workCompleted: userCheckIns.reduce(
        (total, checkIn) =>
          total + checkIn.work_units.filter((unit) => unit.completed).length,
        0
      ),
    }))
    .filter((member) => member.workCompleted > 0)
    .sort((left, right) => right.workCompleted - left.workCompleted)
    .slice(0, 5)

  return {
    activeToday: checkedInTodayByUser.length,
    activeSessions,
    checkedInToday: checkedInTodayByUser,
    completedToday,
    hasAnyCheckIns: checkIns.length > 0,
    mostActive,
    streakLeaders,
    thisWeekActiveUsers: activeThisWeek.size,
    workCompletedToday,
  }
}

function emptyOrganizationCheckInActivity() {
  return {
    activeToday: 0,
    activeSessions: 0,
    checkedInToday: [] as AxisCheckIn[],
    completedToday: 0,
    hasAnyCheckIns: false,
    mostActive: [] as Array<{ userId: string; workCompleted: number }>,
    streakLeaders: [] as Array<{ streak: number; userId: string }>,
    thisWeekActiveUsers: 0,
    workCompletedToday: 0,
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
