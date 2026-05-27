import Link from "next/link"
import { notFound } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
import {
  getOrganizationAdminModel,
  type AxisOrganizationAdminModel,
} from "@/lib/axis-orgs/memberships"
import { OrganizationAdminPanel } from "@/components/axis-orgs/OrganizationAdminPanel"
import styles from "@/app/page.module.css"

type OrgDashboardRouteProps = {
  params: Promise<{
    organization: string
  }>
}

export default async function OrgDashboardRoute({
  params,
}: OrgDashboardRouteProps) {
  const { organization: organizationSlug } = await params
  const organization = await getAxisOrganizationBySlug(organizationSlug)

  if (!organization) notFound()

  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>{organization.name}</p>
            <p className={styles.kicker}>Organization system</p>
            <h1 className={styles.heading}>Run culture.</h1>
            <p className={styles.text}>Sign in to continue.</p>
            <div className={styles.entryActions}>
              <Link className={styles.action} href="/sign-in">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const adminModel = organization.id
    ? await getOrganizationAdminModel(organization.id)
    : emptyOrganizationModel()

  return (
    <OrganizationAdminPanel
      activeMembersThisWeek={adminModel.activeMembersThisWeek}
      attendancePercent={adminModel.attendancePercent}
      dailyVisibility={adminModel.dailyVisibility}
      members={adminModel.members}
      operationalTrust={adminModel.operationalTrust}
      operatingSummary={adminModel.operatingSummary}
      organizationName={organization.name}
      participationContinuity={adminModel.participationContinuity}
      recentActivity={adminModel.recentActivity}
      streakLeaders={adminModel.streakLeaders}
      supportVisibility={adminModel.supportVisibility}
    />
  )
}

function emptyOrganizationModel() {
  return {
    activeMembersThisWeek: 0,
    attendancePercent: 0,
    dailyVisibility: {
      activeSessions: 0,
      activeToday: 0,
      checkedInToday: 0,
      completedToday: 0,
      mostActiveToday: "waiting",
      topStreak: "waiting",
    },
    invites: [],
    members: [],
    operatingSummary: [
      {
        detail: "0 active this week",
        label: "active members",
        tone: "watch",
        value: "0 total",
      },
      {
        detail: "completion loop ready",
        label: "session participation",
        tone: "watch",
        value: "0h",
      },
      {
        detail: "participation waiting",
        label: "continuity",
        tone: "watch",
        value: "building",
      },
      {
        detail: "streaks start after check-ins",
        label: "streak leaders",
        tone: "watch",
        value: "0 active",
      },
      {
        detail: "leaderboard movement starts with check-ins",
        label: "leaderboard",
        tone: "watch",
        value: "open",
      },
    ],
    operationalTrust: [
      {
        detail: "players can start from Build History",
        label: "player entry",
        state: "ready",
        value: "open",
      },
      {
        detail: "first saved check-in waiting",
        label: "persistence",
        state: "waiting",
        value: "history empty",
      },
      {
        detail: "active sessions appear after check-in",
        label: "session state",
        state: "ready",
        value: "ready",
      },
    ],
    participationContinuity: "First streak waiting",
    recentActivity: [],
    settings: {
      homeSessionsEnabled: false,
      leaderboardEnabled: true,
      locationVerificationEnabled: false,
      nfcEnabled: false,
      qrStationsEnabled: false,
    },
    streakLeaders: [],
    supportVisibility: [
      {
        detail: "participation will appear here",
        label: "checked in today",
        value: "0",
      },
      {
        detail: "completed sessions will appear here",
        label: "completed",
        value: "0",
      },
      {
        detail: "streak leaders begin after check-ins",
        label: "top streak",
        value: "waiting",
      },
    ],
  } satisfies AxisOrganizationAdminModel
}
