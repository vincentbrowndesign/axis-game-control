import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  formatAttendanceDate,
  getActiveTodayCount,
  getAttendanceSummary,
} from "@/lib/axis-daily/attendance"
import { getAxisLeaderboard } from "@/lib/axis-daily/leaderboard"
import { ContinuousAxisHome } from "@/components/axis-daily/ContinuousAxisHome"
import styles from "./page.module.css"

export default async function HomePage() {
  const identity = await getAxisRequestIdentity()
  const summary = identity ? await getAttendanceSummary(identity, 12) : null
  const leaderboard = identity ? await getAxisLeaderboard() : []
  const activeTodayCount = identity ? await getActiveTodayCount() : 0
  const lastCheckIn = summary?.checkIns[0]
  const checkedInToday = lastCheckIn ? isToday(lastCheckIn.occurred_at) : false
  const lastCheckInLabel = lastCheckIn
    ? formatLastCheckIn(lastCheckIn.occurred_at)
    : "No check-in yet"
  const streakLabel = `${summary?.streakDays || 0} days`
  const ritualLabel = checkedInToday && lastCheckIn
    ? `Checked in \u2014 ${formatAttendanceTime(lastCheckIn.occurred_at)}`
    : "Check in"
  const leaderboardPlacement = getLeaderboardPlacement(
    leaderboard,
    identity?.clerkUserId || identity?.supabaseUserId || ""
  )
  const weeklyActiveCount =
    leaderboard.find((category) => category.id === "hours-this-week")?.entries
      .length || 0
  const leaderboardSignal =
    leaderboardPlacement !== "unranked"
      ? `${leaderboardPlacement} in motion`
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
  const history = checkIns.slice(0, 8).map((checkIn) => ({
    dateLabel: formatAttendanceDate(checkIn.occurred_at),
    id: checkIn.id,
    title: checkIn.workout_type,
  }))
  const completedDays = new Set(
    checkIns.map((checkIn) => toDateKey(new Date(checkIn.occurred_at)))
  )
  const continuityDays = buildContinuityDays(completedDays)
  const accumulation = buildAccumulationGrid(checkIns.length)

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>Axis</p>
            <p className={styles.kicker}>Membership memory</p>
            <h1 className={styles.heading}>Enter Axis.</h1>
            <p className={styles.text}>
              A private member presence for showing up, staying connected,
              and returning with memory intact.
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

  return (
    <ContinuousAxisHome
      checkedInToday={checkedInToday}
      activeTodayLabel={activeTodayLabel}
      continuityDays={continuityDays}
      history={history}
      lastCheckInLabel={lastCheckInLabel}
      leaderboardSignal={leaderboardSignal}
      leaderboardPlacement={leaderboardPlacement}
      participationSignal={participationSignal}
      progressionCells={accumulation}
      ritualLabel={ritualLabel}
      streakDays={summary?.streakDays || 0}
      streakLabel={streakLabel}
    />
  )
}

function getLeaderboardPlacement(
  categories: Awaited<ReturnType<typeof getAxisLeaderboard>>,
  memberId: string
) {
  if (!memberId) return "unranked"

  for (const category of categories) {
    const entry = category.entries.find((candidate) => candidate.id === memberId)

    if (entry) {
      return `#${entry.rank}`
    }
  }

  return "unranked"
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
  const date = new Date(value)
  const today = new Date()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function isYesterday(value: string) {
  const date = new Date(value)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  )
}

function buildContinuityDays(completedDays: Set<string>) {
  const today = new Date()

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (34 - index))
    const key = toDateKey(date)
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

function buildAccumulationGrid(count: number) {
  return Array.from({ length: 28 }, (_, index) => ({
    id: `cell-${index}`,
    state:
      index < count
        ? ("complete" as const)
        : index === Math.min(count, 27)
          ? ("active" as const)
          : ("empty" as const),
  }))
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}
