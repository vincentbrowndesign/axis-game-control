import { notFound } from "next/navigation"
import {
  getAxisOrganizationBySlug,
  normalizeOrganizationSlug,
} from "@/lib/axis-orgs/organizations"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getTodaySession } from "@/lib/axis-orgs/sessions"
import { TrainCheckInButton } from "@/components/axis-orgs/TrainCheckInButton"
import styles from "@/app/page.module.css"

type OrganizationTrainPageProps = {
  params: Promise<{
    organization: string
  }>
}

const ACTIVE_ORGANIZATIONS = new Set(["bridge", "city2city"])

export const runtime = "nodejs"

export default async function OrganizationTrainPage({
  params,
}: OrganizationTrainPageProps) {
  const { organization } = await params
  const organizationSlug = normalizeOrganizationSlug(organization)

  if (!ACTIVE_ORGANIZATIONS.has(organizationSlug)) {
    notFound()
  }

  const axisOrganization = await getAxisOrganizationBySlug(organizationSlug)

  if (!axisOrganization) notFound()

  const identity = await getAxisRequestIdentity()
  const userId = identity?.clerkUserId || identity?.supabaseUserId || ""
  const session = userId
    ? await getTodaySession({ organizationSlug, userId })
    : null

  return (
    <main className={styles.surface}>
      <section className={styles.trainShell}>
        <section className={styles.sessionSurface} aria-label="Training session">
          <TrainCheckInButton
            activeThisWeek={0}
            currentStreak={0}
            durationSeconds={session?.duration_seconds || 0}
            organizationSlug={organizationSlug}
            sessionCompletedAt={session?.ended_at || null}
            sessionId={session?.id || null}
            sessionStartedAt={session?.started_at || null}
            organizationName={axisOrganization.name}
          />
        </section>

        <section className={styles.trainRecords} aria-label="Training record">
          <p>
            <span>CURRENT STREAK</span>
            <strong>
              0 days
            </strong>
          </p>
          <p>
            <span>LAST SESSION</span>
            <strong>none</strong>
          </p>
          <p>
            <span>ACTIVE THIS WEEK</span>
            <strong>0 / 7 days</strong>
          </p>
          <p>
            <span>SESSION COUNT</span>
            <strong>no sessions yet</strong>
          </p>
        </section>

      </section>
    </main>
  )
}
