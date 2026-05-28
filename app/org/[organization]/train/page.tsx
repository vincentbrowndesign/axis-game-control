import { notFound } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getCheckInSummary } from "@/lib/axis-orgs/check-ins"
import {
  getAxisOrganizationBySlug,
  normalizeOrganizationSlug,
} from "@/lib/axis-orgs/organizations"
import { MovementCalibrationFlow } from "@/components/axis-orgs/MovementCalibrationFlow"
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
  const checkInSummary = userId
    ? await getCheckInSummary({ organizationSlug, userId })
    : {
        currentStreak: 0,
        history: [],
        lastCheckIn: null,
        thisWeekCount: 0,
        todayCheckIn: null,
  }
  const sessionStartedAt = checkInSummary.todayCheckIn?.checked_in_at || null
  const sessionCompletedAt = checkInSummary.todayCheckIn?.checked_out_at || null

  return (
    <main className={styles.surface}>
      <section className={styles.trainShell}>
        <section className={styles.sessionSurface} aria-label="Training session">
          <TrainCheckInButton
            activeThisWeek={checkInSummary.thisWeekCount}
            currentStreak={checkInSummary.currentStreak}
            durationMinutes={checkInSummary.todayCheckIn?.duration_minutes || 0}
            sessionCompletedAt={sessionCompletedAt}
            sessionStartedAt={sessionStartedAt}
            organizationSlug={organizationSlug}
            organizationName={axisOrganization.name}
          />

          <MovementCalibrationFlow
            isSessionStarted={Boolean(sessionStartedAt && !sessionCompletedAt)}
            organizationSlug={organizationSlug}
            playerId={userId}
            sessionStartedAt={sessionStartedAt}
          />
        </section>

        <section className={styles.trainRecords} aria-label="Training record">
          <p>
            <span>CURRENT STREAK</span>
            <strong>
              {checkInSummary.currentStreak}{" "}
              {checkInSummary.currentStreak === 1 ? "day" : "days"}
            </strong>
          </p>
          <p>
            <span>LAST SESSION</span>
            <strong>
              {checkInSummary.lastCheckIn
                ? formatCheckInDateTime(checkInSummary.lastCheckIn.checked_in_at)
                : "none"}
            </strong>
          </p>
          <p>
            <span>ACTIVE THIS WEEK</span>
            <strong>{checkInSummary.thisWeekCount} / 7 days</strong>
          </p>
          <p>
            <span>SESSION COUNT</span>
            <strong>
              {checkInSummary.history.length
                ? `${checkInSummary.history.length} ${
                    checkInSummary.history.length === 1 ? "session" : "sessions"
                  }`
                : "no sessions yet"}
            </strong>
          </p>
        </section>

      </section>
    </main>
  )
}

function formatCheckInDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value))
}
