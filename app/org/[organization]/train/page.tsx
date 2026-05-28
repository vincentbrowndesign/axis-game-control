import { notFound } from "next/navigation"
import {
  getAxisOrganizationBySlug,
  normalizeOrganizationSlug,
} from "@/lib/axis-orgs/organizations"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  getTodaySession,
  getUserSessionContinuity,
} from "@/lib/axis-orgs/sessions"
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
  const continuity = userId
    ? await getUserSessionContinuity({ organizationSlug, userId })
    : {
        activeThisWeek: 0,
        currentStreak: 0,
        lastSessionLabel: "none",
        leaderboardLabel: "opens after first session",
        recentSessions: [],
        sessionCount: 0,
      }

  return (
    <main className={styles.surface}>
      <section className={styles.trainShell}>
        <section className={styles.sessionSurface} aria-label="Training session">
          <TrainCheckInButton
            activeThisWeek={continuity.activeThisWeek}
            currentStreak={continuity.currentStreak}
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
              {continuity.currentStreak} {continuity.currentStreak === 1 ? "day" : "days"}
            </strong>
          </p>
          <p>
            <span>LAST SESSION</span>
            <strong>{continuity.lastSessionLabel}</strong>
          </p>
          <p>
            <span>ACTIVE THIS WEEK</span>
            <strong>{continuity.activeThisWeek} / 7 days</strong>
          </p>
          <p>
            <span>LEADERBOARD</span>
            <strong>{continuity.leaderboardLabel}</strong>
          </p>
        </section>

        <section className={styles.trainHistory} aria-label="Axis history">
          <header>
            <span>AXIS HISTORY</span>
            <strong>
              {continuity.sessionCount
                ? `${continuity.sessionCount} ${continuity.sessionCount === 1 ? "session" : "sessions"}`
                : "no sessions yet"}
            </strong>
          </header>
          <div>
            {continuity.recentSessions.length ? (
              continuity.recentSessions.map((recentSession) => (
                <span
                  className={
                    recentSession.status === "complete"
                      ? styles.trainHistoryNodeComplete
                      : styles.trainHistoryNodeActive
                  }
                  key={recentSession.id}
                >
                  {recentSession.label}
                </span>
              ))
            ) : (
              <span className={styles.trainHistoryEmpty}>
                History begins after check in.
              </span>
            )}
          </div>
          <p className={styles.trainMemoryArchive}>
            <span>REPLAY MEMORY</span>
            <strong>
              {continuity.sessionCount
                ? "archive after participation"
                : "available after first session"}
            </strong>
          </p>
        </section>
      </section>
    </main>
  )
}
