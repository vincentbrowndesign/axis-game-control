import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  formatAttendanceDate,
  getAttendanceSummary,
  getPresenceSummary,
  type AxisTrainingCheckIn,
} from "@/lib/axis-daily/attendance"
import styles from "./page.module.css"

export default async function HomePage() {
  const identity = await getAxisRequestIdentity()
  const [summary, presence] = identity
    ? await Promise.all([getAttendanceSummary(identity, 12), getPresenceSummary()])
    : [null, null]
  const lastCheckIn = summary?.checkIns[0]
  const recentSessions = summary?.checkIns.slice(0, 4) || []
  const memberLabel = identity ? memberName(identity.storageKey) : "Member"
  const checkedInToday = lastCheckIn ? isToday(lastCheckIn.occurred_at) : false
  const currentStatus = checkedInToday ? "Checked in today" : "Ready to check in"
  const lastCheckInLabel = lastCheckIn
    ? `${formatAttendanceDate(lastCheckIn.occurred_at)} / ${lastCheckIn.workout_type}`
    : "No check-in yet"

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
    <main className={styles.surface}>
      <section className={styles.memberHomeShell}>
        <header className={styles.memberHeader}>
          <div>
            <p className={styles.brand}>Axis</p>
            <p className={styles.kicker}>Member home</p>
            <h1 className={styles.memberTitle}>Welcome back, {memberLabel}.</h1>
          </div>
          <div className={styles.headerSignals} aria-label="Member status">
            <Signal label="streak" value={`${summary?.streakDays || 0} days`} />
            <Signal label="last check-in" value={lastCheckInLabel} />
            <Signal label="status" value={currentStatus} />
          </div>
        </header>

        <section className={styles.ritualBand} aria-label="Daily check in">
          <div>
            <p className={styles.kicker}>Daily ritual</p>
            <h2 className={styles.ritualTitle}>Show up. Mark the day.</h2>
            <p className={styles.text}>
              Your Axis History grows from presence first. Check in when you
              arrive, then let the work accumulate.
            </p>
          </div>
          <Link className={styles.primaryAction} href="/check-in">
            Check In
          </Link>
        </section>

        <section className={styles.memberGrid}>
          <section className={styles.historyPanel} aria-label="Axis History">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Axis History</p>
                <h2 className={styles.sectionTitle}>Recent activity</h2>
              </div>
              <Link className={styles.smallLink} href="/memory">
                View history
              </Link>
            </div>
            <div className={styles.stats}>
              <Stat value={summary?.checkIns.length || 0} label="check-ins" />
              <Stat value={summary?.totalMinutes || 0} label="minutes" />
              <Stat value={summary?.streakDays || 0} label="streak" />
            </div>
            <div className={styles.sessionList}>
              {recentSessions.length ? (
                recentSessions.map((session) => (
                  <HistoryRow key={session.id} session={session} />
                ))
              ) : (
                <p className={styles.emptyState}>
                  No history yet. Check in to start the record.
                </p>
              )}
            </div>
          </section>

          <section className={styles.presencePanel} aria-label="Presence">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Presence</p>
                <h2 className={styles.sectionTitle}>Gym signal</h2>
              </div>
            </div>
            <div className={styles.presenceCount}>
              <span>{presence?.checkedInToday || 0}</span>
              <p>checked in today</p>
            </div>
            <div className={styles.presenceList}>
              {presence?.recent.length ? (
                presence.recent.map((entry) => (
                  <div className={styles.presenceRow} key={entry.id}>
                    <span>{memberName(entry.clerk_user_id || entry.user_id || entry.id)}</span>
                    <span>{entry.workout_type}</span>
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>No gym presence yet today.</p>
              )}
            </div>
            <Link className={styles.secondaryAction} href="/check-in">
              Check in
            </Link>
          </section>
        </section>
      </section>
    </main>
  )
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.signal}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function HistoryRow({ session }: { session: AxisTrainingCheckIn }) {
  return (
    <div className={styles.sessionRow}>
      <span className={styles.sessionDate}>
        {formatAttendanceDate(session.occurred_at)}
      </span>
      <span className={styles.sessionName}>{session.workout_type}</span>
      <span className={styles.sessionMeta}>{session.duration_minutes} min</span>
    </div>
  )
}

function memberName(value: string) {
  const suffix = value.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()

  return suffix ? `Member ${suffix}` : "Member"
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
