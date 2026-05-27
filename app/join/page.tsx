import Link from "next/link"
import { redirect } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { JoinCodePanel } from "@/components/axis-orgs/JoinCodePanel"
import styles from "@/app/page.module.css"

type JoinOrganizationPageProps = {
  searchParams?: Promise<{
    code?: string
    org?: string
  }>
}

export default async function JoinOrganizationPage({
  searchParams,
}: JoinOrganizationPageProps) {
  const search = searchParams ? await searchParams : {}
  const organization = normalizeSlug(search.org || "")
  const code = normalizeCode(search.code || "")

  if (organization && code) {
    redirect(`/join/${organization}/${code}`)
  }

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
              Sign in first, then open the invite link from your coach.
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

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40)
}

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64)
}
