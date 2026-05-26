import Link from "next/link"
import { notFound } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
import {
  canManageOrganization,
  getOrganizationAdminModel,
  getOrganizationMembership,
} from "@/lib/axis-orgs/memberships"
import { OrganizationAdminPanel } from "@/components/axis-orgs/OrganizationAdminPanel"
import styles from "@/app/page.module.css"

type OrganizationAdminPageProps = {
  params: Promise<{
    organization: string
  }>
}

export default async function OrganizationAdminPage({
  params,
}: OrganizationAdminPageProps) {
  const { organization: organizationSlug } = await params
  const organization = await getAxisOrganizationBySlug(organizationSlug)

  if (!organization) notFound()

  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>{organization.name}</p>
            <p className={styles.kicker}>Organization control</p>
            <h1 className={styles.heading}>Sign in.</h1>
            <p className={styles.text}>
              Organization control is available to coaches, admins, and owners.
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

  if (!organization.id) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>{organization.name}</p>
            <p className={styles.kicker}>Organization control</p>
            <h1 className={styles.heading}>Setup waiting.</h1>
            <p className={styles.text}>
              Apply the organization migration to unlock roles, invites,
              settings, and member continuity for this organization.
            </p>
          </div>
        </section>
      </main>
    )
  }

  const membership = await getOrganizationMembership(organization.id, identity)

  if (!canManageOrganization(membership?.role)) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>{organization.name}</p>
            <p className={styles.kicker}>Organization control</p>
            <h1 className={styles.heading}>Coach access.</h1>
            <p className={styles.text}>
              Ask an organization coach, admin, or organization owner to assign your role.
            </p>
          </div>
        </section>
      </main>
    )
  }

  const adminModel = await getOrganizationAdminModel(organization.id)

  return (
    <OrganizationAdminPanel
      activeMembersThisWeek={adminModel.activeMembersThisWeek}
      attendancePercent={adminModel.attendancePercent}
      dailyVisibility={adminModel.dailyVisibility}
      invites={adminModel.invites}
      members={adminModel.members}
      organizationName={organization.name}
      organizationSlug={organization.slug}
      participationContinuity={adminModel.participationContinuity}
      recentActivity={adminModel.recentActivity}
      settings={adminModel.settings}
      streakLeaders={adminModel.streakLeaders}
    />
  )
}
