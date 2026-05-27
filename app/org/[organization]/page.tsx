import Link from "next/link"
import { notFound } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { ensureAxisOrganizationBySlug } from "@/lib/axis-orgs/organizations"
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
  const organization = await ensureAxisOrganizationBySlug(organizationSlug)

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
      continuityMomentum: "Continuity begins after first check-in.",
      mostActiveToday: "No check-ins yet",
      participationMovement: "No check-ins yet.",
      topStreak: "No check-ins yet",
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
        detail: "Waiting for first session.",
        label: "session participation",
        tone: "watch",
        value: "0h",
      },
      {
        detail: "0% weekly attendance",
        label: "continuity",
        tone: "watch",
        value: "0%",
      },
      {
        detail: "Continuity begins after first check-in.",
        label: "streak leaders",
        tone: "watch",
        value: "0 active",
      },
      {
        detail: "0 ranked members",
        label: "leaderboard",
        tone: "watch",
        value: "open",
      },
    ],
    operationalTrust: [
      {
        detail: "Build History entry active",
        label: "player entry",
        state: "ready",
        value: "open",
      },
      {
        detail: "No check-ins yet.",
        label: "persistence",
        state: "ready",
        value: "0 saved",
      },
      {
        detail: "Waiting for first session.",
        label: "session state",
        state: "ready",
        value: "0 active",
      },
    ],
    participationContinuity: "Continuity begins after first check-in.",
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
        detail: "No check-ins yet.",
        label: "checked in today",
        value: "0",
      },
      {
        detail: "Waiting for first session.",
        label: "completed",
        value: "0",
      },
      {
        detail: "Continuity begins after first check-in.",
        label: "top streak",
        value: "0 days",
      },
    ],
  } satisfies AxisOrganizationAdminModel
}
