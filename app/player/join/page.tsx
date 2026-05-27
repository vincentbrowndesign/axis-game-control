import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { JoinCodePanel } from "@/components/axis-orgs/JoinCodePanel"
import styles from "@/app/page.module.css"

export default async function PlayerJoinPage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>Axis</p>
            <p className={styles.kicker}>Player entry</p>
            <h1 className={styles.heading}>Build history.</h1>
            <p className={styles.text}>Sign in to continue.</p>
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
