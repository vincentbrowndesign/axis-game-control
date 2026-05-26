"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import type {
  AxisDailyVisibility,
  AxisInvite,
  AxisMemberContinuity,
  AxisOrganizationOperatingItem,
  AxisOperationalTrustItem,
  AxisOrganizationActivity,
  AxisOrganizationRole,
  AxisOrganizationSettings,
  AxisSupportVisibilityItem,
} from "@/lib/axis-orgs/memberships"
import styles from "./OrganizationAdminPanel.module.css"

type OrganizationAdminPanelProps = {
  activeMembersThisWeek: number
  attendancePercent: number
  dailyVisibility: AxisDailyVisibility
  invites: AxisInvite[]
  members: AxisMemberContinuity[]
  operationalTrust: AxisOperationalTrustItem[]
  operatingSummary: AxisOrganizationOperatingItem[]
  organizationName: string
  organizationSlug: string
  participationContinuity: string
  recentActivity: AxisOrganizationActivity[]
  settings: AxisOrganizationSettings
  streakLeaders: AxisMemberContinuity[]
  supportVisibility: AxisSupportVisibilityItem[]
}

const ROLE_OPTIONS: AxisOrganizationRole[] = [
  "player",
  "coach",
  "admin",
  "organization_owner",
]

export function OrganizationAdminPanel({
  activeMembersThisWeek,
  attendancePercent,
  dailyVisibility,
  invites,
  members,
  operationalTrust,
  operatingSummary,
  organizationName,
  organizationSlug,
  participationContinuity,
  recentActivity,
  settings,
  streakLeaders,
  supportVisibility,
}: OrganizationAdminPanelProps) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const [latestInvitePath, setLatestInvitePath] = useState("")

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setMessage("Saving invite")

    const response = await postMemberAction(organizationSlug, {
      action: "invite",
      email: String(form.get("email") || ""),
      role: String(form.get("role") || "player"),
    })

    setPending(false)
    setLatestInvitePath(response.joinPath || "")
    setMessage(response.ok ? "Invite saved" : response.error || "Invite failed")
    if (response.ok) router.refresh()
  }

  async function assignRole(membershipId: string, role: string) {
    setPending(true)
    setMessage("Saving role")

    const response = await postMemberAction(organizationSlug, {
      action: "assign-role",
      membershipId,
      role,
    })

    setPending(false)
    setMessage(response.ok ? "Role saved" : response.error || "Role failed")
    if (response.ok) router.refresh()
  }

  async function removeMember(membershipId: string) {
    setPending(true)
    setMessage("Removing member")

    const response = await postMemberAction(organizationSlug, {
      action: "remove",
      membershipId,
    })

    setPending(false)
    setMessage(response.ok ? "Member removed" : response.error || "Remove failed")
    if (response.ok) router.refresh()
  }

  async function toggleSetting(key: keyof AxisOrganizationSettings, value: boolean) {
    setPending(true)
    setMessage("Saving setting")

    const response = await fetch(`/api/organizations/${organizationSlug}/settings`, {
      body: JSON.stringify({ [key]: value }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then((result) => result.json().catch(() => ({ ok: false })))

    setPending(false)
    setMessage(response.ok ? "Setting saved" : response.error || "Setting failed")
    if (response.ok) router.refresh()
  }

  return (
    <main className={styles.surface}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>{organizationName}</p>
            <h1>Organization control.</h1>
          </div>
          <p className={styles.status}>{pending ? "Saving" : message || "Ready"}</p>
        </header>

        <section className={styles.operatingPanel}>
          <div className={styles.panelHeader}>
            <span>Org overview</span>
            <strong>Run training culture</strong>
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
            <span>Today</span>
            <strong>{organizationName} rhythm</strong>
          </div>
          <div className={styles.dailyMetrics}>
            <Metric label="checked in" value={String(dailyVisibility.checkedInToday)} />
            <Metric label="completed" value={String(dailyVisibility.completedToday)} />
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
            <span>Operational pulse</span>
            <strong>Core loop health</strong>
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
            <span>Coach / parent view</span>
            <strong>Consistency and completion</strong>
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
          <form className={styles.panel} onSubmit={submitInvite}>
            <div className={styles.panelHeader}>
              <span>Invite</span>
              <strong>Players and staff</strong>
            </div>
            <input name="email" placeholder="member@email.com" type="email" />
            <select name="role" defaultValue="player">
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button disabled={pending} type="submit">
              Save invite
            </button>
            {latestInvitePath ? (
              <p className={styles.inviteLink}>{latestInvitePath}</p>
            ) : null}
          </form>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>Continuity</span>
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
            <span>Settings</span>
            <strong>Optional systems</strong>
          </div>
          <div className={styles.settingsGrid}>
            <SettingToggle
              checked={settings.leaderboardEnabled}
              label="Enable leaderboard"
              onChange={(value) => toggleSetting("leaderboardEnabled", value)}
            />
            <SettingToggle
              checked={settings.homeSessionsEnabled}
              label="Enable home sessions"
              onChange={(value) => toggleSetting("homeSessionsEnabled", value)}
            />
            <SettingToggle
              checked={settings.nfcEnabled}
              label="Enable NFC later"
              onChange={(value) => toggleSetting("nfcEnabled", value)}
            />
            <SettingToggle
              checked={settings.qrStationsEnabled}
              label="Enable QR stations later"
              onChange={(value) => toggleSetting("qrStationsEnabled", value)}
            />
            <SettingToggle
              checked={settings.locationVerificationEnabled}
              label="Enable location verification later"
              onChange={(value) =>
                toggleSetting("locationVerificationEnabled", value)
              }
            />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Members</span>
            <strong>Roles and continuity</strong>
          </div>
          <div className={styles.memberList}>
            {members.length ? (
              members.map((member) => (
                <article className={styles.memberRow} key={member.id}>
                  <div>
                    <span>{memberLabel(member)}</span>
                    <strong>{member.checkInsThisWeek} this week</strong>
                    <em>
                      {member.completedSessions} completed / {member.streakDays} day streak
                    </em>
                  </div>
                  <select
                    defaultValue={member.role}
                    onChange={(event) => assignRole(member.id, event.target.value)}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button disabled={pending} onClick={() => removeMember(member.id)}>
                    Remove
                  </button>
                </article>
              ))
            ) : (
              <p className={styles.empty}>No members saved yet.</p>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Pending</span>
            <strong>Invites</strong>
          </div>
          <div className={styles.inviteList}>
            {invites.length ? (
              invites.map((invite) => (
                <article className={styles.inviteRow} key={invite.id}>
                  <span>{invite.email}</span>
                  <strong>{invite.role}</strong>
                  <code>{`/join/${invite.inviteToken}`}</code>
                  <em>{invite.status}</em>
                </article>
              ))
            ) : (
              <p className={styles.empty}>No pending invites.</p>
            )}
          </div>
        </section>
      </section>
    </main>
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

function SettingToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <label className={styles.toggle}>
      <span>{label}</span>
      <input
        defaultChecked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  )
}

async function postMemberAction(organizationSlug: string, body: unknown) {
  return fetch(`/api/organizations/${organizationSlug}/members`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).then((result) => result.json().catch(() => ({ ok: false })))
}

function memberLabel(member: AxisMemberContinuity) {
  const value = member.clerkUserId || member.userId || "member"
  const suffix = value.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()

  return suffix ? `MEMBER ${suffix}` : "MEMBER"
}
