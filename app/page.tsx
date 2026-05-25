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
    ? formatLastCheckIn(lastCheckIn.occurred_at)
    : "No check-in yet"
  const streakLabel = `${summary?.streakDays || 0} day ${
    summary?.streakDays === 1 ? "streak" : "streak"
  }`
  const primaryActionLabel = checkedInToday && lastCheckIn
    ? `Checked in - ${formatAttendanceTime(lastCheckIn.occurred_at)}`
    : "Check In"
  const historyLine = "Write your story."

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
            <h2 className={styles.ritualTitle}>
              {checkedInToday ? "Checked In" : "Check In"}
            </h2>
            <p className={styles.text}>{historyLine}</p>
          </div>
          <Link
            className={`${styles.primaryAction} ${
              checkedInToday ? styles.primaryActionComplete : ""
            }`}
            href="/check-in"
          >
            {primaryActionLabel}
          </Link>
        </section>

        <section className={styles.historyStrip} aria-label="Axis History">
          <div className={styles.historySignal}>
            <span>streak</span>
            <strong>{streakLabel}</strong>
          </div>
          <div className={styles.historySignal}>
            <span>last check-in</span>
            <strong>{lastCheckInLabel}</strong>
          </div>
          <Link className={styles.smallLink} href="/memory">
            View Axis History
          </Link>
        </section>
      </section>
    </main>
  )
}

function formatAttendanceTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatLastCheckIn(value: string) {
  if (isToday(value)) {
    return `Today / ${formatAttendanceTime(value)}`
  }

  if (isYesterday(value)) {
    return "Yesterday"
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
