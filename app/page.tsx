import Link from "next/link"
import { redirect } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import styles from "@/app/page.module.css"

export default async function HomePage() {
  const identity = await getAxisRequestIdentity()

  if (identity) {
    redirect("/join")
  }

  return (
    <main className={styles.surface}>
      <section className={styles.entryShell}>
        <div className={styles.entryCopy}>
          <p className={styles.brand}>Axis</p>
          <p className={styles.kicker}>Athletic continuity</p>
          <h1 className={styles.heading}>Build your history.</h1>
          <p className={styles.text}>
            Sign in, join your organization, check in, and let the work stay
            attached to you.
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
