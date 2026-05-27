import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  canManageOrganization,
  getAxisMembershipWorlds,
} from "@/lib/axis-orgs/memberships"
import styles from "@/app/page.module.css"

const ACTIVE_ORGANIZATIONS = [
  { name: "Bridge", slug: "bridge" },
  { name: "City 2 City", slug: "city2city" },
]

export default async function OrgPage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>Axis</p>
            <p className={styles.kicker}>Organization entry</p>
            <h1 className={styles.heading}>Run culture.</h1>
            <p className={styles.text}>
              Sign in with a coach, admin, or owner role.
            </p>
            <div className={styles.entryActions}>
              <Link className={styles.action} href="/sign-in">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const memberships = await getAxisMembershipWorlds(identity)
  const organizationWorlds = memberships.filter((membership) =>
    canManageOrganization(membership.role),
  )

  return (
    <main className={styles.surface}>
      <section className={styles.modeShell}>
        <header className={styles.modeHeader}>
          <p className={styles.brand}>Axis</p>
          <p className={styles.kicker}>Organization system</p>
          <h1 className={styles.modeHeading}>Run culture.</h1>
          <p className={styles.modeText}>Members / participation / continuity</p>
        </header>

        <div className={styles.modeGrid}>
          {(organizationWorlds.length ? organizationWorlds : ACTIVE_ORGANIZATIONS).map(
            (organization) => {
              const active = "organizationSlug" in organization
              const slug = active
                ? organization.organizationSlug
                : organization.slug
              const name = active
                ? organization.organizationName
                : organization.name

              return (
                <Link
                  className={`${styles.modeCard} ${styles.modeCardOrganization}`}
                  href={`/org/${slug}`}
                  key={slug}
                >
                  <span>Organization</span>
                  <strong>{name}</strong>
                  <small>{active ? "Culture live" : "Open culture view"}</small>
                </Link>
              )
            },
          )}
        </div>
      </section>
    </main>
  )
}
