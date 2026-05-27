import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  formatAttendanceDate,
  getAttendanceSummary,
} from "@/lib/axis-daily/attendance"
import { getAxisMembershipWorlds } from "@/lib/axis-orgs/memberships"
import styles from "@/components/axis-daily/AxisDaily.module.css"

export default async function MemoryPage() {
  const identity = await getAxisRequestIdentity()
  const memberships = identity ? await getAxisMembershipWorlds(identity) : []
  const playerWorld = memberships[0]
  const summary = identity
    ? await getAttendanceSummary(identity, 60, playerWorld?.organizationId)
    : null
  const checkIns = summary?.checkIns || []
  const organizationName = playerWorld?.organizationName || "Axis"

  return (
    <main className={styles.surface}>
      <header className={styles.telemetry}>
        <div>
          <p className={styles.eyebrow}>{organizationName}</p>
          <h1 className={styles.title}>Axis History</h1>
        </div>
        <Link className={styles.link} href="/">
          Check in
        </Link>
      </header>

      <section className={styles.main}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Return tomorrow</p>
          <h2 className={styles.title}>The work stays attached to {organizationName}.</h2>
          <p className={styles.statement}>
            Recent training days, streaks, notes, and sessions stay inside
            your Axis History.
          </p>
        </div>

        <section className={styles.panel} aria-label="Axis History">
          {!identity ? (
            <>
              <p className={styles.status}>
                Sign in to see Axis History.
              </p>
              <Link className={styles.button} href="/sign-in">
                Sign in
              </Link>
            </>
          ) : (
            <>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>
                    {summary?.streakDays || 0}
                  </span>
                  <span className={styles.statLabel}>day streak</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{checkIns.length}</span>
                  <span className={styles.statLabel}>check-ins</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>
                    {summary?.totalMinutes || 0}
                  </span>
                  <span className={styles.statLabel}>minutes</span>
                </div>
              </div>
              <div className={styles.history}>
                {checkIns.length === 0 ? (
                  <div className={styles.empty}>No history yet.</div>
                ) : (
                  checkIns.map((checkIn) => (
                    <div className={styles.row} key={checkIn.id}>
                      <span className={styles.meta}>
                        {formatAttendanceDate(checkIn.occurred_at)}
                      </span>
                      <span className={styles.name}>
                        {checkIn.workout_type}
                        {checkIn.notes ? ` / ${checkIn.notes}` : ""}
                      </span>
                      <span className={styles.meta}>
                        {checkIn.duration_minutes} min
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.link} href="/leaderboard">
          Leaderboard
        </Link>
      </footer>
    </main>
  )
}
