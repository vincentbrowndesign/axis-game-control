import { notFound } from "next/navigation"
import {
  getAxisOrganizationBySlug,
  normalizeOrganizationSlug,
} from "@/lib/axis-orgs/organizations"
import styles from "@/app/page.module.css"

type OrganizationCoachPageProps = {
  params: Promise<{
    organization: string
  }>
}

const ACTIVE_ORGANIZATIONS = new Set(["bridge", "city2city"])

export const runtime = "nodejs"

export default async function OrganizationCoachPage({
  params,
}: OrganizationCoachPageProps) {
  const { organization } = await params
  const organizationSlug = normalizeOrganizationSlug(organization)

  if (!ACTIVE_ORGANIZATIONS.has(organizationSlug)) {
    notFound()
  }

  const axisOrganization = await getAxisOrganizationBySlug(organizationSlug)

  if (!axisOrganization) notFound()

  return (
    <main className={styles.surface}>
      <section className={styles.coachShell}>
        <header className={styles.coachHeader}>
          <p className={styles.brand}>{axisOrganization.name}</p>
          <h1 className={styles.coachPulse}>
            0 ACTIVE TODAY
          </h1>
        </header>

        <section className={styles.coachSection} aria-label="Active today">
          <span>ACTIVE TODAY</span>
          <strong>0</strong>
          <p>No sessions yet.</p>
        </section>

        <section className={styles.coachSection} aria-label="Checked in">
          <span>CHECKED IN</span>
          <p>No check-ins yet.</p>
        </section>

        <section className={styles.coachSection} aria-label="Attendance">
          <span>ATTENDANCE</span>
          <strong>0</strong>
          <p>Waiting for first session.</p>
        </section>

        <section className={styles.coachSection} aria-label="Current streaks">
          <span>CURRENT STREAKS</span>
          <p>Streaks begin after first session.</p>
        </section>
      </section>
    </main>
  )
}
