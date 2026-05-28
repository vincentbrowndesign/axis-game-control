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
            {activity.activeToday} ACTIVE TODAY
          </h1>
        </header>

        <section className={styles.coachSection} aria-label="Active today">
          <span>ACTIVE TODAY</span>
          <strong>{activity.activeToday}</strong>
          <p>
            {activity.hasAnyCheckIns
              ? `${activity.activeToday} checked in today.`
              : "First check-in starts the board."}
          </p>
        </section>

        <section className={styles.coachSection} aria-label="Current sessions">
          <span>CURRENT SESSIONS</span>
          <strong>{activity.activeSessions}</strong>
          <p>
            {activity.activeSessions
              ? `${activity.activeSessions} training now.`
              : "No live sessions right now."}
          </p>
        </section>

        <section className={styles.coachSection} aria-label="Current streaks">
          <span>CURRENT STREAKS</span>
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

        <section className={styles.coachSection} aria-label="Most active">
          <span>MOST ACTIVE</span>
          {activity.mostActive.length ? (
            <ul className={styles.coachList}>
              {activity.mostActive.map((member) => (
                <li key={member.userId}>
                  <strong>{formatUserLabel(member.userId)}</strong>
                  <em>{member.workCompleted} work</em>
                </li>
              ))}
            </ul>
          ) : (
            <p>Work appears after completed sessions.</p>
          )}
        </section>

        <section className={styles.coachSection} aria-label="Work completed">
          <span>WORK COMPLETED</span>
          <strong>{activity.workCompletedToday}</strong>
          <p>
            {activity.workCompletedToday
              ? `${activity.workCompletedToday} work units completed today.`
              : "Waiting for completed work."}
          </p>
        </section>
      </section>
    </main>
  )
}

function formatUserLabel(userId: string) {
  if (userId.includes("@")) return userId

  return userId.length > 16 ? `${userId.slice(0, 8)}...${userId.slice(-4)}` : userId
}
