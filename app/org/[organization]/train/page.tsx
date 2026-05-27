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
  const checkedInAt = checkInSummary.todayCheckIn?.checked_in_at || null

  return (
    <main className={styles.surface}>
      <section className={styles.trainShell}>
        <header className={styles.trainHeader}>
          <p className={styles.brand}>{axisOrganization.name}</p>
          <h1 className={styles.trainTitle}>Train</h1>
        </header>

        <section className={styles.trainStatus} aria-label="Today">
          <span>Today:</span>
          <strong>
            {checkedInAt
              ? `Checked in - ${formatCheckInTime(checkedInAt)}`
              : "Not checked in yet"}
          </strong>
        </section>

        <TrainCheckInButton
          checkedInAt={checkedInAt}
          organizationSlug={organizationSlug}
        />

        <section className={styles.trainRecords} aria-label="Training continuity">
          <p>
            <span>Current streak:</span>
            <strong>
              {checkInSummary.currentStreak}{" "}
              {checkInSummary.currentStreak === 1 ? "day" : "days"}
            </strong>
          </p>
          <p>
            <span>Last check-in:</span>
            <strong>
              {checkInSummary.lastCheckIn
                ? formatCheckInDateTime(checkInSummary.lastCheckIn.checked_in_at)
                : "none"}
            </strong>
          </p>
          <p>
            <span>This week:</span>
            <strong>{checkInSummary.thisWeekCount} / 7 days</strong>
          </p>
          <p>
            <span>History:</span>
            <strong>
              {checkInSummary.history.length
                ? checkInSummary.history
                    .map((checkIn) => formatCheckInDate(checkIn.checked_in_at))
                    .join(", ")
                : "no sessions yet"}
            </strong>
          </p>
        </section>

        <MovementCalibrationFlow
          checkedInAt={checkedInAt}
          isCheckedIn={Boolean(checkedInAt)}
          organizationSlug={organizationSlug}
          playerId={userId}
        />
      </section>
    </main>
  )
}

function formatCheckInTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatCheckInDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value))
}

function formatCheckInDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(value))
}
