import Link from "next/link"
import { currentUser } from "@clerk/nextjs/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  formatAttendanceDate,
  getAttendanceSummary,
} from "@/lib/axis-daily/attendance"
import {
  completedMinutesThisMonth,
  completedMinutesThisWeek,
  completedSessionMinutes,
  formatEffortHours,
  formatSessionDuration,
} from "@/lib/axis-daily/duration"
import { axisDateKey } from "@/lib/axis-daily/continuity"
import {
  getAxisLeaderboard,
  type AxisLeaderboardCategory,
} from "@/lib/axis-daily/leaderboard"
import { getAxisMembershipWorlds } from "@/lib/axis-orgs/memberships"
import styles from "./page.module.css"

type ProfileDay = {
  id: string
  label: string
  state: "active" | "complete" | "empty" | "future" | "missed"
}

export default async function PlayerProfilePage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <p className={styles.brand}>Axis</p>
          <h1 className={styles.title}>Save file.</h1>
          <p className={styles.statement}>
            Sign in to see the history you are building.
          </p>
          <Link className={styles.link} href="/sign-in">
            Sign in
          </Link>
        </section>
      </main>
    )
  }

  const [user, memberships] = await Promise.all([
    currentUser().catch(() => null),
    getAxisMembershipWorlds(identity),
  ])
  const primaryOrganization = memberships[0]
  const [summary, leaderboard] = await Promise.all([
    getAttendanceSummary(identity, 180, primaryOrganization?.organizationId),
    getAxisLeaderboard(primaryOrganization?.organizationId),
  ])
  const memberId = identity.clerkUserId || identity.supabaseUserId || ""
  const completedDays = new Set(
    summary.checkIns.map((checkIn) => axisDateKey(new Date(checkIn.occurred_at)))
  )
  const profileDays = buildProfileDays(completedDays)
  const recentParticipation = summary.checkIns.slice(0, 6)
  const completedSessions = summary.checkIns.filter(
    (checkIn) => checkIn.checked_out_at
  )
  const standing = getLeaderboardStanding(leaderboard, memberId)
  const athleteName = user?.firstName || "Player"
  const displayName = user?.firstName
    ? `${user.firstName}'s save file`
    : "Player save file"
  const organizationName = primaryOrganization?.organizationName || "Axis"
  const organizationRole = primaryOrganization?.role || "player"
  const activeThisMonth = profileDays.filter(
    (day) => day.state === "complete"
  ).length
  const totalSessions = summary.checkIns.length
  const hoursInvested = formatEffortHours(summary.totalMinutes)

  return (
    <main className={styles.surface}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.brand}>Axis profile</p>
            <h1 className={styles.title}>{displayName}</h1>
          </div>
          <div className={styles.identityCard} aria-label="Player identity">
            <span>organization</span>
            <strong>{organizationName}</strong>
            <em>{organizationRole}</em>
          </div>
        </header>

        <section className={styles.identitySurface} aria-label="Athletic identity">
          <div className={styles.identityMark} aria-hidden="true">
            {athleteInitials(athleteName)}
          </div>
          <div className={styles.identityRecord}>
            <span>athletic identity</span>
            <strong>{athleteName}</strong>
            <em>
              {organizationName} / {activeThisMonth} active this month / {standing.placement}
            </em>
          </div>
          <div className={styles.identityPulse} aria-label="Effort continuity">
            <span>hours invested</span>
            <strong>{hoursInvested}</strong>
            <em>{completedSessions.length} completed sessions</em>
          </div>
        </section>

        <section className={styles.metricGrid} aria-label="Player save data">
          <article className={styles.metric}>
            <span>current streak</span>
            <strong>{summary.streakDays}</strong>
            <em>{summary.streakDays === 1 ? "day active" : "days active"}</em>
          </article>
          <article className={styles.metric}>
            <span>total sessions</span>
            <strong>{totalSessions}</strong>
            <em>{completedSessions.length} completed</em>
          </article>
          <article className={styles.metric}>
            <span>hours invested</span>
            <strong>{hoursInvested}</strong>
            <em>{formatEffortHours(completedMinutesThisWeek(summary.checkIns))} this week</em>
          </article>
          <article className={styles.metric}>
            <span>active this month</span>
            <strong>{activeThisMonth}</strong>
            <em>{formatEffortHours(completedMinutesThisMonth(summary.checkIns))} logged</em>
          </article>
          <article className={styles.metric}>
            <span>organization</span>
            <strong>{organizationName}</strong>
            <em>{organizationRole}</em>
          </article>
          <article className={styles.metric}>
            <span>current rank</span>
            <strong>{standing.placement}</strong>
            <em>{standing.context}</em>
          </article>
        </section>

        <section className={styles.profileBody}>
          <article className={styles.historyPanel}>
            <div className={styles.sectionHeader}>
              <span>active history</span>
              <strong>{profileDays.filter((day) => day.state === "complete").length} marks</strong>
            </div>
            <div className={styles.historyGrid} aria-label="Active history calendar">
              {profileDays.map((day) => (
                <span
                  aria-label={`${day.label} ${day.state}`}
                  className={
                    day.state === "complete"
                      ? styles.dayComplete
                      : day.state === "active"
                        ? styles.dayActive
                        : day.state === "future"
                          ? styles.dayFuture
                          : day.state === "missed"
                            ? styles.dayMissed
                            : styles.day
                  }
                  key={day.id}
                >
                  {day.label}
                </span>
              ))}
            </div>
          </article>

          <article className={styles.recentPanel}>
            <div className={styles.sectionHeader}>
              <span>recent participation</span>
              <strong>{recentParticipation.length ? "saved" : "ready"}</strong>
            </div>
            <div className={styles.recentList}>
              {recentParticipation.length ? (
                recentParticipation.map((checkIn) => (
                  <div className={styles.recentItem} key={checkIn.id}>
                    <span>{formatAttendanceDate(checkIn.occurred_at)}</span>
                    <strong>{checkIn.workout_type}</strong>
                    <em>
                      {formatAttendanceTime(checkIn.occurred_at)}
                      {checkIn.checked_out_at
                        ? ` / ${formatSessionDuration(completedSessionMinutes(checkIn))}`
                        : ""}
                    </em>
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>No saved sessions yet.</p>
              )}
            </div>
          </article>
        </section>

        <footer className={styles.footer}>
          <Link className={styles.link} href="/">
            Check in
          </Link>
          <Link className={styles.link} href="/leaderboard">
            Leaderboard
          </Link>
        </footer>
      </section>
    </main>
  )
}

function getLeaderboardStanding(
  categories: AxisLeaderboardCategory[],
  memberId: string
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

function buildProfileDays(completedDays: Set<string>) {
  const today = new Date()
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1)
    const key = axisDateKey(date)

    return {
      id: key,
      label: String(index + 1).padStart(2, "0"),
      state: completedDays.has(key)
        ? ("complete" as const)
        : isToday(date)
          ? ("active" as const)
          : date > today
            ? ("future" as const)
            : ("missed" as const),
    } satisfies ProfileDay
  })
}

function formatAttendanceTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function isToday(date: Date) {
  const today = new Date()

  return axisDateKey(date) === axisDateKey(today)
}

function athleteInitials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AX"
}
