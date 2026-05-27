import Link from "next/link"
import { notFound } from "next/navigation"
import { ensureAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
import styles from "@/app/page.module.css"

type OrganizationStartPageProps = {
  params: Promise<{
    organization: string
  }>
}

const ACTIVE_ORGANIZATIONS = new Set(["bridge", "city2city"])

export default async function OrganizationStartPage({
  params,
}: OrganizationStartPageProps) {
  const { organization: organizationSlug } = await params

  if (!ACTIVE_ORGANIZATIONS.has(organizationSlug)) {
    notFound()
  }

  const organization = await ensureAxisOrganizationBySlug(organizationSlug)

  if (!organization) notFound()

  return (
    <main className={styles.surface}>
      <section className={styles.modeShell}>
        <header className={styles.modeHeader}>
          <p className={styles.brand}>{organization.name}</p>
          <h1 className={styles.modeHeading}>{organization.name}</h1>
          <p className={styles.modeText}>What are you here to do?</p>
        </header>

        <div className={styles.modeGrid}>
          <Link className={styles.modeCard} href={`/org/${organization.slug}/train`}>
            <span>Train</span>
            <strong>Train</strong>
            <em>Check in and build your history.</em>
            <small>Open</small>
          </Link>
          <Link
            className={`${styles.modeCard} ${styles.modeCardOrganization}`}
            href={`/org/${organization.slug}/coach`}
          >
            <span>Coach</span>
            <strong>Coach</strong>
            <em>View attendance and participation.</em>
            <small>Open</small>
          </Link>
        </div>
      </section>
    </main>
  )
}
