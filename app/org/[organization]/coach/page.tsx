import { notFound } from "next/navigation"
import { getOrganizationCheckInActivity } from "@/lib/axis-orgs/check-ins"
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

  const activity = await getOrganizationCheckInActivity(organizationSlug)

  return (
    <main className={styles.surface}>
      <section className={styles.coachShell}>
        <header className={styles.coachHeader}>
          <p className={styles.brand}>{axisOrganization.name}</p>
          <h1 className={styles.coachPulse}>
            {activity.activeToday} active today
          </h1>
        </header>

        <section className={styles.coachSection} aria-label="Active today">
          <span>Active today</span>
          <strong>{activity.activeToday}</strong>
          <p>
            {activity.hasAnyCheckIns
              ? `${activity.activeToday} checked in today.`
              : "Activity begins after first check-in."}
          </p>
        </section>

        <section className={styles.coachSection} aria-label="Checked in">
          <span>Checked in</span>
          {activity.checkedInToday.length ? (
            <ul className={styles.coachList}>
              {activity.checkedInToday.map((checkIn) => (
                <li key={checkIn.id}>
                  <strong>{formatUserLabel(checkIn.user_id)}</strong>
                  <em>{formatCheckInTime(checkIn.checked_in_at)}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {activity.hasAnyCheckIns
                ? "Waiting for first session today."
                : "No check-ins yet."}
            </p>
          )}
        </section>

        <section className={styles.coachSection} aria-label="This week">
          <span>This week</span>
          <strong>{activity.thisWeekActiveUsers}</strong>
          <p>
            {activity.thisWeekActiveUsers
              ? `${activity.thisWeekActiveUsers} unique active this week.`
              : "Waiting for first session."}
          </p>
        </section>

        <section className={styles.coachSection} aria-label="Current streaks">
          <span>Current streaks</span>
          {activity.streakLeaders.length ? (
            <ul className={styles.coachList}>
              {activity.streakLeaders.map((leader) => (
                <li key={leader.userId}>
                  <strong>{formatUserLabel(leader.userId)}</strong>
                  <em>{leader.streak} days</em>
                </li>
              ))}
            </ul>
          ) : (
            <p>Streaks begin after more check-ins.</p>
          )}
        </section>
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

function formatUserLabel(userId: string) {
  if (userId.includes("@")) return userId

  return userId.length > 16 ? `${userId.slice(0, 8)}...${userId.slice(-4)}` : userId
}
