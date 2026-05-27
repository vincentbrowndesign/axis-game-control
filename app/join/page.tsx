import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { JoinCodePanel } from "@/components/axis-orgs/JoinCodePanel"
import styles from "@/app/page.module.css"

export default async function JoinOrganizationPage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>Axis</p>
            <p className={styles.kicker}>Organization entry</p>
            <h1 className={styles.heading}>Sign in to join.</h1>
            <p className={styles.text}>
              Choose Bridge or City 2 City after sign in.
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

  return <JoinCodePanel />
}
