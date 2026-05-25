import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAttendanceSummary } from "@/lib/axis-daily/attendance"
import styles from "@/components/axis-daily/AxisDaily.module.css"

export default async function HomePage() {
  const identity = await getAxisRequestIdentity()
  const summary = identity ? await getAttendanceSummary(identity, 12) : null
  const lastCheckIn = summary?.checkIns[0]

  return (
    <main className={styles.surface}>
      <header className={styles.telemetry}>
        <div>
          <p className={styles.eyebrow}>Axis Daily</p>
          <h1 className={styles.title}>Training continuity</h1>
        </div>
        <Link className={styles.link} href={identity ? "/memory" : "/sign-in"}>
          {identity ? "Memory" : "Sign in"}
        </Link>
      </header>

      <section className={styles.main}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Identity / Check-in / Return</p>
          <h2 className={styles.title}>Show up. Log the work. Come back tomorrow.</h2>
          <p className={styles.statement}>
            Axis keeps attendance and training memory connected to the player,
            quietly, day after day.
          </p>
        </div>

        <section className={styles.panel} aria-label="Daily training state">
          {identity ? (
            <>
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
                  <span className={styles.statLabel}>recent check-ins</span>
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
                  ? `Last training: ${lastCheckIn.workout_type}`
                  : "No training days saved yet."}
              </p>
              <Link className={styles.button} href="/check-in">
                Check in
              </Link>
            </>
          ) : (
            <>
              <p className={styles.status}>
                Sign in to keep attendance and training memory tied to one
                identity.
              </p>
              <Link className={styles.button} href="/sign-in">
                Sign in
              </Link>
            </>
          )}
        </section>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.link} href="/check-in">
          Check-in
        </Link>
        <Link className={styles.link} href="/memory">
          Memory
        </Link>
      </footer>
    </main>
  )
}
