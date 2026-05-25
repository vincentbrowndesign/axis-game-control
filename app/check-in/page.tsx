import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { CheckInForm } from "@/components/axis-daily/CheckInForm"
import styles from "@/components/axis-daily/AxisDaily.module.css"

export default async function CheckInPage() {
  const identity = await getAxisRequestIdentity()

  return (
    <main className={styles.surface}>
      <header className={styles.telemetry}>
        <div>
          <p className={styles.eyebrow}>Axis Check-in</p>
          <h1 className={styles.title}>Training day</h1>
        </div>
        <Link className={styles.link} href="/memory">
          Axis History
        </Link>
      </header>

      <section className={styles.main}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Gym verified</p>
          <h2 className={styles.title}>Confirm the day before the work disappears.</h2>
          <p className={styles.statement}>
            Axis checks that you are at the gym, then saves a short training
            record to your Axis History.
          </p>
        </div>

        {identity ? (
          <CheckInForm />
        ) : (
          <section className={styles.panel}>
            <p className={styles.status}>
              Sign in before checking in.
            </p>
            <Link className={styles.button} href="/sign-in">
              Sign in
            </Link>
          </section>
        )}
      </section>
    </main>
  )
}
