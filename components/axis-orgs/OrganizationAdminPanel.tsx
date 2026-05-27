import type {
  AxisDailyVisibility,
  AxisMemberContinuity,
  AxisOrganizationOperatingItem,
  AxisOperationalTrustItem,
  AxisOrganizationActivity,
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
  recentActivity: AxisOrganizationActivity[]
  streakLeaders: AxisMemberContinuity[]
  supportVisibility: AxisSupportVisibilityItem[]
}

export function OrganizationAdminPanel({
  activeMembersThisWeek,
  attendancePercent,
  dailyVisibility,
  members,
  operationalTrust,
  operatingSummary,
  organizationName,
  participationContinuity,
  recentActivity,
  streakLeaders,
  supportVisibility,
}: OrganizationAdminPanelProps) {
  const completionRate =
    dailyVisibility.checkedInToday > 0
      ? Math.round(
          (dailyVisibility.completedToday / dailyVisibility.checkedInToday) * 100,
        )
      : 0
  const cultureState =
    dailyVisibility.activeToday > 0
      ? `${dailyVisibility.activeToday} active today`
      : "culture waiting"

  return (
    <main className={styles.surface}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>{organizationName}</p>
            <h1>Culture operations.</h1>
          </div>
          <p className={styles.status}>Live</p>
        </header>

        <section className={styles.commandRail} aria-label="Organization culture status">
          <CommandSignal label="today" value={cultureState} tone="active" />
          <CommandSignal
            label="completed"
            value={`${dailyVisibility.completedToday} sessions`}
            tone={dailyVisibility.completedToday > 0 ? "active" : "steady"}
          />
          <CommandSignal
            label="this week"
            value={`${activeMembersThisWeek} active`}
            tone={activeMembersThisWeek > 0 ? "active" : "steady"}
          />
          <CommandSignal
            label="attendance"
            value={`${attendancePercent}% health`}
            tone={attendancePercent > 0 ? "steady" : "idle"}
          />
        </section>

        <section className={styles.operatingPanel}>
          <div className={styles.panelHeader}>
            <span>Culture health</span>
            <strong>Is our culture alive?</strong>
          </div>
          <div className={styles.operatingGrid}>
            {operatingSummary.map((item) => (
              <article
                className={`${styles.operatingItem} ${
                  item.tone === "active"
                    ? styles.operatingItemActive
                    : item.tone === "steady"
                      ? styles.operatingItemSteady
                      : ""
                }`}
                key={item.label}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.dailyPanel}>
          <div className={styles.panelHeader}>
            <span>Live today</span>
            <strong>{organizationName} participation</strong>
          </div>
          <div className={styles.dailyMetrics}>
            <Metric label="checked in" value={String(dailyVisibility.checkedInToday)} />
            <Metric label="completed" value={String(dailyVisibility.completedToday)} />
            <Metric label="completion" value={`${completionRate}%`} />
            <Metric label="active sessions" value={String(dailyVisibility.activeSessions)} />
            <Metric label="active today" value={String(dailyVisibility.activeToday)} />
            <Metric label="most active" value={dailyVisibility.mostActiveToday} />
            <Metric label="top streak" value={dailyVisibility.topStreak} />
          </div>
          <div className={styles.activityList}>
            {recentActivity.length ? (
              recentActivity.map((activity) => (
                <article className={styles.activityRow} key={activity.id}>
                  <span>{activity.label}</span>
                  <strong>{activity.status}</strong>
                  <em>{activity.detail}</em>
                </article>
              ))
            ) : (
              <p className={styles.empty}>No check-ins yet today.</p>
            )}
          </div>
        </section>

        <section className={styles.trustPanel}>
          <div className={styles.panelHeader}>
            <span>Continuity health</span>
            <strong>Can people trust the record?</strong>
          </div>
          <div className={styles.trustGrid}>
            {operationalTrust.map((item) => (
              <article
                className={`${styles.trustItem} ${
                  item.state === "active"
                    ? styles.trustItemActive
                    : item.state === "ready"
                      ? styles.trustItemReady
                      : ""
                }`}
                key={item.label}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.supportPanel}>
          <div className={styles.panelHeader}>
            <span>Support visibility</span>
            <strong>Growth without surveillance</strong>
          </div>
          <div className={styles.supportGrid}>
            {supportVisibility.map((item) => (
              <article className={styles.supportItem} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.grid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>Streak leaders</span>
              <strong>{participationContinuity}</strong>
            </div>
            <div className={styles.metrics}>
              <Metric label="attendance" value={`${attendancePercent}%`} />
              <Metric label="active" value={String(activeMembersThisWeek)} />
              <Metric label="members" value={String(members.length)} />
            </div>
            <div className={styles.leaders}>
              {streakLeaders.length ? (
                streakLeaders.map((member) => (
                  <article className={styles.leader} key={member.id}>
                    <span>{memberLabel(member)}</span>
                    <strong>{member.streakDays} day streak</strong>
                  </article>
                ))
              ) : (
                <p className={styles.empty}>No streak leaders yet.</p>
              )}
            </div>
          </section>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Member continuity</span>
            <strong>Roles and participation</strong>
          </div>
          <div className={styles.memberList}>
            {members.length ? (
              members.map((member) => (
                <article className={styles.memberRow} key={member.id}>
                  <div>
                    <span>{memberLabel(member)}</span>
                    <strong>{memberHoursLabel(member.minutesThisWeek)} this week</strong>
                    <em>
                      {member.completedSessions} completed / {member.streakDays} day streak
                    </em>
                  </div>
                </article>
              ))
            ) : (
              <p className={styles.empty}>No members saved yet.</p>
            )}
          </div>
        </section>

      </section>
    </main>
  )
}

function CommandSignal({
  label,
  tone,
  value,
}: {
  label: string
  tone: "active" | "idle" | "steady"
  value: string
}) {
  return (
    <article
      className={`${styles.commandSignal} ${
        tone === "active"
          ? styles.commandSignalActive
          : tone === "steady"
            ? styles.commandSignalSteady
            : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function memberLabel(member: AxisMemberContinuity) {
  const value = member.clerkUserId || member.userId || "member"
  const suffix = value.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()

  return suffix ? `MEMBER ${suffix}` : "MEMBER"
}

function memberHoursLabel(minutes: number) {
  if (minutes <= 0) return "0h"

  const hours = minutes / 60

  return hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`
}
