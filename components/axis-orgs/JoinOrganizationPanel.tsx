"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./JoinOrganizationPanel.module.css"

type JoinOrganizationPanelProps = {
  activeMembers: number
  activeStreaks: number
  authenticated: boolean
  checkedInToday: number
  invitePath: string
  organizationAvatar: string
  organizationName: string
  role: string
  token: string
}

export function JoinOrganizationPanel({
  activeMembers,
  activeStreaks,
  authenticated,
  checkedInToday,
  invitePath,
  organizationAvatar,
  organizationName,
  role,
  token,
}: JoinOrganizationPanelProps) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)

  async function acceptInvite() {
    if (!authenticated) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(invitePath)}`)
      return
    }

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
        <p className={styles.kicker}>Organization loaded</p>
        <h1>Join {organizationName}.</h1>
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
          <span>join</span>
          <span>check in</span>
          <span>history</span>
          <span>return</span>
        </div>
        <p className={styles.roleLine}>{role}</p>
        <button disabled={pending} onClick={acceptInvite} type="button">
          {pending ? "Joining" : "Continue"}
        </button>
        <p className={styles.status}>
          {message || (authenticated ? "Ready" : "Sign in to continue")}
        </p>
      </section>
    </main>
  )
}
