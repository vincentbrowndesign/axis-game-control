import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  formatAttendanceDate,
  getAttendanceSummary,
} from "@/lib/axis-daily/attendance"
import styles from "./page.module.css"

export default async function HomePage() {
  const identity = await getAxisRequestIdentity()
  const summary = identity ? await getAttendanceSummary(identity, 12) : null
  const lastCheckIn = summary?.checkIns[0]
  const checkedInToday = lastCheckIn ? isToday(lastCheckIn.occurred_at) : false
  const lastCheckInLabel = lastCheckIn
    ? `${formatAttendanceDate(lastCheckIn.occurred_at)} / ${lastCheckIn.workout_type}`
    : "No check-in yet"
  const historyLine = checkedInToday
    ? "Today is already part of your Axis History."
    : "Check in to attach today to your Axis History."

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
      <section className={styles.memberRitualShell}>
        <header className={styles.memberHeader}>
          <p className={styles.brand}>Axis</p>
          <p className={styles.kicker}>Axis History</p>
          <h1 className={styles.memberTitle}>Welcome back.</h1>
        </header>

        <section className={styles.ritualCenter} aria-label="Daily check in">
          <div>
            <p className={styles.kicker}>Daily ritual</p>
            <h2 className={styles.ritualTitle}>Check In</h2>
            <p className={styles.text}>
              Show up, mark the day, and let the work keep its place.
            </p>
          </div>
          <Link className={styles.primaryAction} href="/check-in">
            Check In
          </Link>
        </section>

        <section className={styles.historyStrip} aria-label="Axis History">
          <div className={styles.historySignal}>
            <span>current streak</span>
            <strong>{summary?.streakDays || 0} days</strong>
          </div>
          <div className={styles.historySignal}>
            <span>last check-in</span>
            <strong>{lastCheckInLabel}</strong>
          </div>
          <p className={styles.historyLine}>{historyLine}</p>
          <Link className={styles.smallLink} href="/memory">
            View Axis History
          </Link>
        </section>
      </section>
    </main>
  )
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
