"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./JoinOrganizationPanel.module.css"

type JoinOrganizationPanelProps = {
  activeMembers: number
  activeStreaks: number
  checkedInToday: number
  inviteCode?: string | null
  organizationAvatar: string
  organizationName: string
  role: string
  token: string
}

export function JoinOrganizationPanel({
  activeMembers,
  activeStreaks,
  checkedInToday,
  inviteCode,
  organizationAvatar,
  organizationName,
  role,
  token,
}: JoinOrganizationPanelProps) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)

  async function acceptInvite() {
    setPending(true)
    setMessage("Joining")

    const response = await fetch(`/api/organization-invites/${token}/accept`, {
      method: "POST",
    }).then((result) => result.json().catch(() => ({ ok: false })))

    setPending(false)

    if (!response.ok) {
      setMessage(response.error || "Invite could not be accepted")
      return
    }

    setMessage("Joined")
    router.push(`/${response.organizationSlug}?joined=1`)
    router.refresh()
  }

  return (
    <main className={styles.surface}>
      <section className={styles.card}>
        <p className={styles.avatar}>{organizationAvatar}</p>
        <p className={styles.kicker}>Joining</p>
        <h1>{organizationName}.</h1>
        <p className={styles.copy}>
          Step into the organization world. Your first check-in starts the
          record here.
        </p>
        <div className={styles.joinStats} aria-label="Organization activity">
          <span>
            <strong>{activeMembers}</strong>
            active members
          </span>
          <span>
            <strong>{checkedInToday}</strong>
            checked in today
          </span>
          <span>
            <strong>{activeStreaks}</strong>
            active streaks
          </span>
        </div>
        <div className={styles.entryPath} aria-label="First session path">
          <span>join organization</span>
          <span>first check-in</span>
          <span>history started</span>
          <span>streak active</span>
        </div>
        <p className={styles.roleLine}>
          {inviteCode ? `Invite code: ${inviteCode}` : "Invite link active"} / {role}
        </p>
        <button disabled={pending} onClick={acceptInvite} type="button">
          {pending ? "Joining" : "Join organization"}
        </button>
        <p className={styles.status}>{message || "Ready"}</p>
      </section>
    </main>
  )
}
