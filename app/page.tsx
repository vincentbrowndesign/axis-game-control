import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAttendanceSummary } from "@/lib/axis-daily/attendance"
import styles from "./page.module.css"

export default async function HomePage() {
  const identity = await getAxisRequestIdentity()
  const summary = identity ? await getAttendanceSummary(identity, 12) : null
  const lastCheckIn = summary?.checkIns[0]

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
      <section className={styles.memberShell}>
        <div className={styles.entryCopy}>
          <p className={styles.brand}>Axis</p>
          <p className={styles.kicker}>Axis History</p>
          <h1 className={styles.heading}>Welcome back.</h1>
          <p className={styles.text}>
            Check in, log the work, and keep your Axis History moving.
          </p>
        </div>

        <section className={styles.memberPanel} aria-label="Axis History">
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {summary?.streakDays || 0}
              </span>
              <span className={styles.statLabel}>day streak</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {summary?.checkIns.length || 0}
              </span>
              <span className={styles.statLabel}>check-ins</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {summary?.totalMinutes || 0}
              </span>
              <span className={styles.statLabel}>minutes</span>
            </div>
          </div>
          <p className={styles.status}>
            {lastCheckIn
              ? `Last entry: ${lastCheckIn.workout_type}`
              : "No training days saved yet."}
          </p>
          <div className={styles.entryActions}>
            <Link className={styles.action} href="/check-in">
              Check in
            </Link>
            <Link className={styles.action} href="/memory">
              Axis History
            </Link>
          </div>
        </section>
      </section>
    </main>
  )
}
