"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./JoinOrganizationPanel.module.css"

type JoinOrganizationPanelProps = {
  organizationAvatar: string
  organizationName: string
  role: string
  token: string
}

export function JoinOrganizationPanel({
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
        <p className={styles.kicker}>Organization invite</p>
        <h1>Join {organizationName}.</h1>
        <p className={styles.copy}>
          Enter the organization world as {role}. Your first check-in starts
          the record here.
        </p>
        <div className={styles.entryPath} aria-label="First session path">
          <span>join organization</span>
          <span>first check-in</span>
          <span>history started</span>
          <span>streak active</span>
        </div>
        <button disabled={pending} onClick={acceptInvite} type="button">
          {pending ? "Joining" : "Join organization"}
        </button>
        <p className={styles.status}>{message || "Ready"}</p>
      </section>
    </main>
  )
}
