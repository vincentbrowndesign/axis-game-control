import Link from "next/link"
import { notFound } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  formatAttendanceDate,
  getActiveTodayCount,
  getAttendanceSummary,
  getOrganizationCulture,
  getParticipationSignals,
} from "@/lib/axis-daily/attendance"
import {
  axisDateKey,
  axisMonthKey,
  axisStartOfWeek,
} from "@/lib/axis-daily/continuity"
import { getAxisLeaderboard } from "@/lib/axis-daily/leaderboard"
import { buildContinuityReminders } from "@/lib/axis-daily/reminders"
import { AXIS_DEFAULT_SESSION_SEGMENTS } from "@/lib/axis-daily/session-flow"
import { ensureAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
import { ContinuousAxisHome } from "@/components/axis-daily/ContinuousAxisHome"
import styles from "@/app/page.module.css"

type PlayerContinuitySurfaceProps = {
  joined?: boolean
  organizationSlug: string
}

export async function PlayerContinuitySurface({
  joined = false,
  organizationSlug,
}: PlayerContinuitySurfaceProps) {
  const organization = await ensureAxisOrganizationBySlug(organizationSlug)

  if (!organization) notFound()

  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>
              <span className={styles.organizationAvatar} aria-hidden="true">
                {organization.avatar}
              </span>
              {organization.name}
            </p>
            <p className={styles.kicker}>Player system</p>
            <h1 className={styles.heading}>Build history.</h1>
            <p className={styles.text}>
              Check in, build history, and stay connected to the people showing
              up with you.
            </p>
            <div className={styles.entryActions}>
              <Link className={styles.action} href="/sign-in">
                Sign in
              </Link>
              <Link className={styles.action} href="/sign-up">
                Sign up
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const organizationId = organization.id
  const summary = await getAttendanceSummary(identity, 60, organizationId)
  const leaderboard = await getAxisLeaderboard(organizationId)
  const activeTodayCount = await getActiveTodayCount(organizationId)
  const participationSignals = await getParticipationSignals(organizationId)
  const organizationCulture = await getOrganizationCulture(organizationId)
  const lastCheckIn = summary?.checkIns[0]
  const checkedInToday = lastCheckIn ? isToday(lastCheckIn.occurred_at) : false
  const checkedOutToday = Boolean(
    checkedInToday && lastCheckIn?.checked_out_at,
  )
  const lastCheckInLabel = lastCheckIn
    ? formatLastCheckIn(lastCheckIn.occurred_at)
    : "No check-in yet"
  const streakLabel = `${summary?.streakDays || 0} days`
  const ritualLabel =
    checkedInToday && lastCheckIn
      ? `Checked in \u2014 ${formatAttendanceTime(lastCheckIn.occurred_at)}`
      : "Check in"
  const checkoutLabel = lastCheckIn?.checked_out_at
    ? `Checked out \u2014 ${formatAttendanceTime(lastCheckIn.checked_out_at)}`
    : ""
  const leaderboardStanding = getLeaderboardStanding(
    leaderboard,
    identity.clerkUserId || identity.supabaseUserId || "",
  )
  const weeklyActiveCount =
    leaderboard.find((category) => category.id === "hours-this-week")?.entries
      .length || 0
  const leaderboardSignal =
    leaderboardStanding.placement !== "unranked"
      ? leaderboardStanding.context
      : weeklyActiveCount
        ? `${weeklyActiveCount} active files`
        : "board open"
  const participationSignal = weeklyActiveCount
    ? `${weeklyActiveCount} active this week`
    : checkedInToday
      ? "history live"
      : "first mark waiting"
  const activeTodayLabel = activeTodayCount
    ? `${activeTodayCount} active today`
    : "floor opening"
  const checkIns = summary?.checkIns || []
  const joinedFromOrganization = joined && checkIns.length === 0
  const activeThisWeek = checkIns.filter(
    (checkIn) => new Date(checkIn.occurred_at) >= axisStartOfWeek(new Date())
  ).length
  const playerContinuityRecords = [
    {
      detail: summary?.streakDays === 1 ? "day active" : "days active",
      label: "current streak",
      value: String(summary?.streakDays || 0),
    },
    {
      detail: organization.name,
      label: "last check-in",
      value: lastCheckIn ? formatLastCheckIn(lastCheckIn.occurred_at) : "None yet",
    },
    {
      detail: activeThisWeek === 1 ? "session this week" : "sessions this week",
      label: "active this week",
      value: String(activeThisWeek),
    },
    {
      detail: checkIns.length === 1 ? "saved session" : "saved sessions",
      label: "total sessions",
      value: String(checkIns.length),
    },
  ]
  const history = checkIns.slice(0, 8).map((checkIn) => ({
    dateLabel: formatAttendanceDate(checkIn.occurred_at),
    id: checkIn.id,
    organizationName: organization.name,
    timeLabel: formatAttendanceTime(checkIn.occurred_at),
    title: checkIn.workout_type,
  }))
  const completedDays = new Set(
    checkIns.map((checkIn) => axisDateKey(new Date(checkIn.occurred_at))),
  )
  const continuityDays = buildContinuityDays(completedDays)
  const accumulation = buildCurrentMonthGrid(completedDays)
  const historyStats = buildHistoryStats(checkIns)
  const reminders = buildContinuityReminders({
    activeTodayCount,
    checkedInToday,
    leaderboard,
    organizationName: organization.name,
    summary,
  })

  return (
    <ContinuousAxisHome
      activeTodayLabel={activeTodayLabel}
      checkedInToday={checkedInToday}
      checkedOutToday={checkedOutToday}
      checkoutLabel={checkoutLabel}
      continuityDays={continuityDays}
      currentSessionTitle={lastCheckIn?.workout_type || "Open Gym"}
      firstSessionActive={checkedOutToday && checkIns.length === 1}
      history={history}
      historyStats={historyStats}
      joinedFromOrganization={joinedFromOrganization}
      lastCheckInLabel={lastCheckInLabel}
      leaderboardPlacement={leaderboardStanding.placement}
      leaderboardSignal={leaderboardSignal}
      organizationAvatar={organization.avatar}
      organizationCulture={organizationCulture}
      organizationName={organization.name}
      organizationSignals={participationSignals}
      organizationSlug={organization.slug}
      participationSignal={participationSignal}
      playerContinuityRecords={playerContinuityRecords}
      progressionCells={accumulation}
      reminders={reminders}
      ritualLabel={ritualLabel}
      sessionSegments={lastCheckIn?.session_segments || AXIS_DEFAULT_SESSION_SEGMENTS}
      streakDays={summary?.streakDays || 0}
      streakLabel={streakLabel}
    />
  )
}

function getLeaderboardStanding(
  categories: Awaited<ReturnType<typeof getAxisLeaderboard>>,
  memberId: string,
) {
  if (!memberId) {
    return {
      context: "MOST ACTIVE",
      placement: "unranked",
    }
  }

  for (const category of categories) {
    const entry = category.entries.find((candidate) => candidate.id === memberId)

    if (entry) {
      return {
        context: leaderboardContext(category.id),
        placement: `#${entry.rank} ${leaderboardScope(category.id)}`,
      }
    }
  }

  return {
    context: "MOST ACTIVE",
    placement: "unranked",
  }
}

function leaderboardContext(categoryId: string) {
  if (categoryId === "active-today") return "MOST ACTIVE TODAY"
  if (categoryId === "active-streak") return "LONGEST STREAK"
  if (categoryId === "monthly-consistency") return "MOST CONSISTENT"
  if (categoryId === "sessions-completed") return "MOST SESSIONS"

  return "MOST ACTIVE"
}

function leaderboardScope(categoryId: string) {
  if (categoryId === "active-today") return "TODAY"
  if (categoryId === "active-streak") return "STREAK"
  if (categoryId === "monthly-consistency") return "MONTH"
  if (categoryId === "sessions-completed") return "SESSIONS"

  return "THIS WEEK"
}

function formatAttendanceTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatLastCheckIn(value: string) {
  if (isToday(value)) {
    return `Today \u2014 ${formatAttendanceTime(value)}`
  }

  if (isYesterday(value)) {
    return `Yesterday \u2014 ${formatAttendanceTime(value)}`
  }

  return formatAttendanceDate(value)
}

function isToday(value: string) {
  return axisDateKey(new Date(value)) === axisDateKey(new Date())
}

function isYesterday(value: string) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return axisDateKey(new Date(value)) === axisDateKey(yesterday)
}

function buildContinuityDays(completedDays: Set<string>) {
  const today = new Date()

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (34 - index))
    const key = axisDateKey(date)
    const isCurrentDay = isToday(date.toISOString())

    return {
      id: key,
      label: String(date.getDate()).padStart(2, "0"),
      state: completedDays.has(key)
        ? ("complete" as const)
        : isCurrentDay
          ? ("active" as const)
          : date > today
            ? ("future" as const)
            : ("empty" as const),
    }
  })
}

function buildCurrentMonthGrid(completedDays: Set<string>) {
  const today = new Date()
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1)
    const key = axisDateKey(date)
    const isCurrentDay = isToday(date.toISOString())

    return {
      id: key,
      label: String(index + 1).padStart(2, "0"),
      state: completedDays.has(key)
        ? ("complete" as const)
        : isCurrentDay
          ? ("active" as const)
          : date > today
            ? ("future" as const)
            : ("missed" as const),
    }
  })
}

function buildHistoryStats(
  checkIns: NonNullable<Awaited<ReturnType<typeof getAttendanceSummary>>>["checkIns"],
) {
  const today = new Date()
  const currentMonth = axisMonthKey(today)
  const monthCheckIns = checkIns.filter(
    (checkIn) => axisMonthKey(new Date(checkIn.occurred_at)) === currentMonth,
  )
  const completedDays = new Set(
    monthCheckIns.map((checkIn) => axisDateKey(new Date(checkIn.occurred_at))),
  )
  let missed = 0

  for (let day = 1; day < today.getDate(); day += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), day)
    if (!completedDays.has(axisDateKey(date))) missed += 1
  }

  return {
    currentMonthParticipation: `${completedDays.size} active days`,
    lastSession: checkIns[0] ? formatLastCheckIn(checkIns[0].occurred_at) : "None yet",
    missedDays: `${missed} missed`,
    totalSessions:
      checkIns.length === 1 ? "1 total session" : `${checkIns.length} total sessions`,
  }
}
