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
          <h1 className={styles.modeHeading}>{organization.name}</h1>
        </header>

        <div className={styles.modeGrid}>
          <Link className={styles.modeCard} href={`/org/${organization.slug}/train`}>
            <strong>Train</strong>
          </Link>
          <Link
            className={`${styles.modeCard} ${styles.modeCardOrganization}`}
            href={`/org/${organization.slug}/coach`}
          >
            <strong>Coach</strong>
          </Link>
        </div>
      </section>
    </main>
  )
}
