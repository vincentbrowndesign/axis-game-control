import type {
  AxisDailyVisibility,
  AxisMemberContinuity,
  AxisOrganizationOperatingItem,
  AxisOperationalTrustItem,
  AxisSupportVisibilityItem,
} from "@/lib/axis-orgs/memberships"
import styles from "./OrganizationAdminPanel.module.css"

type OrganizationAdminPanelProps = {
  activeMembersThisWeek: number
  attendancePercent: number
  dailyVisibility: AxisDailyVisibility
  members: AxisMemberContinuity[]
  operationalTrust: AxisOperationalTrustItem[]
  operatingSummary: AxisOrganizationOperatingItem[]
  organizationName: string
  participationContinuity: string
  streakLeaders: AxisMemberContinuity[]
  supportVisibility: AxisSupportVisibilityItem[]
}

export function OrganizationAdminPanel({
  activeMembersThisWeek,
  dailyVisibility,
  members,
  organizationName,
  streakLeaders,
}: OrganizationAdminPanelProps) {
  const activeStreaks = members.filter((member) => member.streakDays > 0).length
  const mostActiveThisWeek = findMostActiveThisWeek(members)
  const topStreak = streakLeaders[0]
  const heroState = buildHeroState({
    activeMembersThisWeek,
    activeStreaks,
    dailyVisibility,
    mostActiveThisWeek,
    organizationName,
  })

  return (
    <main className={styles.surface}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>{organizationName}</p>
            <h1>{heroState.value}</h1>
            <p className={styles.heroDetail}>{heroState.detail}</p>
          </div>
          <p className={styles.status}>{heroState.signal}</p>
        </header>

        <section className={styles.pulseGrid} aria-label="Organization pulse">
          <PulseSignal
            detail="players active right now"
            label="active today"
            tone={dailyVisibility.activeToday > 0 ? "active" : "idle"}
            value={String(dailyVisibility.activeToday)}
          />
          <PulseSignal
            detail="saved check-ins today"
            label="checked in"
            tone={dailyVisibility.checkedInToday > 0 ? "active" : "idle"}
            value={String(dailyVisibility.checkedInToday)}
          />
          <PulseSignal
            detail="completed today"
            label="completed sessions"
            tone={dailyVisibility.completedToday > 0 ? "active" : "idle"}
            value={String(dailyVisibility.completedToday)}
          />
          <PulseSignal
            detail={topStreak ? `${memberLabel(topStreak)} leading` : "streaks begin after check-ins"}
            label="current streaks"
            tone={activeStreaks > 0 ? "active" : "idle"}
            value={String(activeStreaks)}
          />
          <PulseSignal
            detail={mostActiveThisWeek.detail}
            label="most active this week"
            tone={activeMembersThisWeek > 0 ? "active" : "idle"}
            value={mostActiveThisWeek.value}
          />
        </section>
      </section>
    </main>
  )
}

function PulseSignal({
  detail,
  label,
  tone,
  value,
}: {
  detail: string
  label: string
  tone: "active" | "idle"
  value: string
}) {
  return (
    <article
      className={`${styles.pulseSignal} ${
        tone === "active" ? styles.pulseSignalActive : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  )
}

function memberLabel(member: AxisMemberContinuity) {
  const value = member.clerkUserId || member.userId || "member"
  const suffix = value.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()

  return suffix ? `MEMBER ${suffix}` : "MEMBER"
}

function buildHeroState({
  activeMembersThisWeek,
  activeStreaks,
  dailyVisibility,
  mostActiveThisWeek,
  organizationName,
}: {
  activeMembersThisWeek: number
  activeStreaks: number
  dailyVisibility: AxisDailyVisibility
  mostActiveThisWeek: {
    detail: string
    value: string
  }
  organizationName: string
}) {
  if (dailyVisibility.activeToday > 0) {
    return {
      detail: "active today",
      signal: dailyVisibility.participationMovement,
      value: `${dailyVisibility.activeToday} active today`,
    }
  }

  if (dailyVisibility.activeSessions > 0) {
    return {
      detail: "active sessions",
      signal: dailyVisibility.participationMovement,
      value: `${dailyVisibility.activeSessions} active sessions`,
    }
  }

  if (dailyVisibility.checkedInToday > 0) {
    return {
      detail: "checked in today",
      signal: dailyVisibility.continuityMomentum,
      value: `${dailyVisibility.checkedInToday} checked in`,
    }
  }

  if (activeMembersThisWeek > 0) {
    return {
      detail: mostActiveThisWeek.detail,
      signal: "most active this week",
      value: `${organizationName} moving`,
    }
  }

  if (activeStreaks > 0) {
    return {
      detail: "current streaks",
      signal: dailyVisibility.continuityMomentum,
      value: `${activeStreaks} streaks alive`,
    }
  }

  return {
    detail: "waiting for first check-in",
    signal: "floor opening",
    value: `${organizationName} ready`,
  }
}

function findMostActiveThisWeek(members: AxisMemberContinuity[]) {
  const member = [...members].sort(
    (a, b) =>
      b.checkInsThisWeek - a.checkInsThisWeek ||
      b.minutesThisWeek - a.minutesThisWeek ||
      b.streakDays - a.streakDays
  )[0]

  if (!member || member.checkInsThisWeek <= 0) {
    return {
      detail: "waiting for this week",
      value: "None yet",
    }
  }

  return {
    detail: `${member.checkInsThisWeek} check-in${
      member.checkInsThisWeek === 1 ? "" : "s"
    }`,
    value: memberLabel(member),
  }
}
