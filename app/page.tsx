import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  canManageOrganization,
  getAxisMembershipWorlds,
} from "@/lib/axis-orgs/memberships"
import styles from "@/app/page.module.css"

export default async function HomePage() {
  const identity = await getAxisRequestIdentity()

  if (identity) {
    const memberships = await getAxisMembershipWorlds(identity)
    const playerWorld = memberships[0] || null
    const organizationWorld =
      memberships.find((membership) => canManageOrganization(membership.role)) ||
      null

    return (
      <main className={styles.surface}>
        <section className={styles.modeShell}>
          <header className={styles.modeHeader}>
            <p className={styles.brand}>Axis</p>
            <p className={styles.kicker}>System entry</p>
            <h1 className={styles.modeHeading}>Enter Axis.</h1>
            <p className={styles.modeText}>Player / Organization</p>
          </header>

          <div className={styles.modeGrid}>
            <Link
              className={`${styles.modeCard} ${styles.modeCardPlayer}`}
              href={playerWorld ? `/${playerWorld.organizationSlug}` : "/join"}
            >
              <span>Player</span>
              <strong>Build history</strong>
              <small>
                {playerWorld
                  ? `${playerWorld.organizationName} ready`
                  : "Join an organization"}
              </small>
            </Link>

            <Link
              className={`${styles.modeCard} ${styles.modeCardOrganization}`}
              href={
                organizationWorld
                  ? `/${organizationWorld.organizationSlug}/admin`
                  : "/join"
              }
            >
              <span>Organization</span>
              <strong>Run culture</strong>
              <small>
                {organizationWorld
                  ? `${organizationWorld.organizationName} control`
                  : "Coach/admin role required"}
              </small>
            </Link>
          </div>
        </section>
      </main>
    )
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
