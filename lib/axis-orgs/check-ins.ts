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

  const result = await insertCheckIn({
    organizationSlug,
    userId,
  })

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

  if (workUnitsColumnAvailable !== false) {
    workUnitsColumnAvailable = true
  }

  return {
    checkIn: normalizeCheckIn(result.data),
    duplicate: false,
  }
}

async function insertCheckIn({
  organizationSlug,
  userId,
}: {
  organizationSlug: string
  userId: string
}) {
  const payload: Record<string, unknown> =
    workUnitsColumnAvailable === false
      ? {
          organization_slug: organizationSlug,
          user_id: userId,
        }
      : {
          organization_slug: organizationSlug,
          user_id: userId,
          work_units: [],
        }

  console.info("AXIS START SESSION", {
    hasWorkUnitsDefault: "work_units" in payload,
    organizationSlug,
    stage: "insert-start",
    userId,
  })

  const result = await supabaseAdmin
    .from("check_ins")
    .insert(payload)
    .select(CHECK_IN_SELECT_BASE)
    .single<RawAxisCheckIn>()

  if (!result.error) {
    if (workUnitsColumnAvailable !== false) {
      workUnitsColumnAvailable = true
    }

    return result
  }

  console.error("AXIS START SESSION", {
    code: result.error.code,
    detail: result.error.details,
    hint: result.error.hint,
    message: result.error.message,
    organizationSlug,
    stage: "insert-failed",
    userId,
  })

  if ("work_units" in payload && isMissingWorkUnitsError(result.error)) {
    rememberMissingWorkUnitsColumn({ organizationSlug, stage: "insert-without-work-units" })

    const fallback = await supabaseAdmin
      .from("check_ins")
      .insert({
        organization_slug: organizationSlug,
        user_id: userId,
      })
      .select(CHECK_IN_SELECT_BASE)
      .single<RawAxisCheckIn>()

    console.info("AXIS START SESSION", {
      code: fallback.error?.code,
      hasData: Boolean(fallback.data),
      message: fallback.error?.message,
      organizationSlug,
      stage: "insert-without-work-units",
      userId,
    })

    return fallback
  }

  if (!isMissingWorkUnitsError(result.error)) {
    workUnitsColumnAvailable = true
  }

  return result
}

export async function completeCheckIn({
  checkInId,
  organizationSlug,
  userId,
  workUnits = [],
}: {
  checkInId?: string
  organizationSlug: string
  userId: string
  workUnits?: unknown
}) {
  const existing =
    (checkInId
      ? await getCheckInById({ checkInId, organizationSlug, userId })
      : null) || (await getTodayCheckIn({ organizationSlug, userId }))

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

  console.info("AXIS TRAIN CHECK-OUT", {
    checkedOutAt,
    durationMinutes,
    existingId: existing.id,
    requestedId: checkInId || null,
    organizationSlug,
    stage: "update-start",
    userId,
  })

  const closed = await closeCheckIn({
    checkedOutAt,
    durationMinutes,
    existing,
    requestedId: checkInId,
    organizationSlug,
    userId,
  })

  if ("error" in closed) {
    console.error("AXIS TRAIN CHECK-OUT", {
      error: closed.error instanceof Error ? closed.error.message : closed.error,
      organizationSlug,
      stage: "update-failed",
      userId,
    })

    return {
      error: closed.error,
    }
  }

  const completedCheckIn = closed.checkIn

  if (workUnitsColumnAvailable === false) {
    return {
      checkIn: completedCheckIn,
      duplicate: false,
    }
  }

  try {
    const workResult = await supabaseAdmin
      .from("check_ins")
      .update({
        work_units: normalizeWorkUnits(workUnits),
      })
      .eq("id", existing.id)
      .select(CHECK_IN_SELECT_WITH_WORK)
      .single<RawAxisCheckIn>()

    if (workResult.error) {
      if (isMissingWorkUnitsError(workResult.error)) {
        rememberMissingWorkUnitsColumn({ organizationSlug, stage: "work-units-save-failed" })
      } else {
        workUnitsColumnAvailable = true
      }

      console.warn("AXIS TRAIN WORK UNITS", {
        code: workResult.error.code,
        detail: workResult.error.details,
        hint: workResult.error.hint,
        message: workResult.error.message,
        organizationSlug,
        stage: "work-units-save-failed",
      })

      return {
        checkIn: completedCheckIn,
        duplicate: false,
      }
    }

    workUnitsColumnAvailable = true

    return {
      checkIn: normalizeCheckIn(workResult.data),
      duplicate: false,
    }
  } catch (error) {
    console.warn("AXIS TRAIN WORK UNITS", {
      detail: error instanceof Error ? error.message : error,
      organizationSlug,
      stage: "work-units-save-threw",
    })

    return {
      checkIn: completedCheckIn,
      duplicate: false,
    }
  }
}

async function getCheckInById({
  checkInId,
  organizationSlug,
  userId,
}: {
  checkInId: string
  organizationSlug: string
  userId: string
}) {
  const result = await supabaseAdmin
    .from("check_ins")
    .select(checkInSelect())
    .eq("id", checkInId)
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .maybeSingle<RawAxisCheckIn>()

  if (!result.error) {
    return result.data ? normalizeCheckIn(result.data) : null
  }

  if (isMissingWorkUnitsError(result.error)) {
    rememberMissingWorkUnitsColumn({ organizationSlug, stage: "read-by-id-fallback" })

    const fallback = await supabaseAdmin
      .from("check_ins")
      .select(CHECK_IN_SELECT_BASE)
      .eq("id", checkInId)
      .eq("user_id", userId)
      .eq("organization_slug", organizationSlug)
      .maybeSingle<RawAxisCheckIn>()

    if (!fallback.error) {
      return fallback.data ? normalizeCheckIn(fallback.data) : null
    }
  } else {
    workUnitsColumnAvailable = true
  }

  console.warn("AXIS TRAIN CHECK-OUT", {
    checkInId,
    code: result.error.code,
    detail: result.error.message,
    hint: result.error.hint,
    organizationSlug,
    stage: "read-by-id-failed",
    userId,
  })

  return null
}

async function closeCheckIn({
  checkedOutAt,
  durationMinutes,
  existing,
  requestedId,
  organizationSlug,
  userId,
}: {
  checkedOutAt: string
  durationMinutes: number
  existing: AxisCheckIn
  requestedId?: string
  organizationSlug: string
  userId: string
}) {
  const updatePayload = {
    checked_out_at: checkedOutAt,
    duration_minutes: durationMinutes,
  }
  const byId = await supabaseAdmin
    .from("check_ins")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(CHECK_IN_SELECT_BASE)
    .maybeSingle<RawAxisCheckIn>()

  console.info("AXIS TRAIN CHECK-OUT", {
    code: byId.error?.code,
    hasData: Boolean(byId.data),
    message: byId.error?.message,
    organizationSlug,
    requestedId: requestedId || null,
    stage: "update-by-id",
    userId,
  })

  if (!byId.error && byId.data) {
    return {
      checkIn: normalizeCheckIn(byId.data),
    }
  }

  const { end, start } = axisTodayRange()
  const fallback = await supabaseAdmin
    .from("check_ins")
    .update(updatePayload)
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .gte("checked_in_at", start.toISOString())
    .lt("checked_in_at", end.toISOString())
    .is("checked_out_at", null)
    .select(CHECK_IN_SELECT_BASE)
    .returns<RawAxisCheckIn[]>()

  console.info("AXIS TRAIN CHECK-OUT", {
    code: fallback.error?.code,
    count: fallback.data?.length || 0,
    message: fallback.error?.message,
    organizationSlug,
    requestedId: requestedId || null,
    stage: "update-active-fallback",
    userId,
  })

  if (!fallback.error && fallback.data?.length) {
    return {
      checkIn: normalizeCheckIn(newestCheckIn(fallback.data)),
    }
  }

  return {
    error:
      byId.error ||
      fallback.error ||
      new Error("No active session row was updated"),
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
    duration_minutes: cleanDurationNumber(row.duration_minutes),
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

  return cleanDurationNumber(diffMinutes)
}

function cleanDurationNumber(value: unknown) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(Math.round(number), 600))
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

function newestCheckIn(checkIns: RawAxisCheckIn[]) {
  return [...checkIns].sort(
    (left, right) =>
      new Date(right.checked_in_at).getTime() -
      new Date(left.checked_in_at).getTime()
  )[0]
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
