"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./JoinOrganizationPanel.module.css"

const V1_ORGANIZATIONS = [
  {
    avatar: "BR",
    name: "Bridge",
    slug: "bridge",
  },
  {
    avatar: "C2",
    name: "City 2 City",
    slug: "city2city",
  },
]

export function JoinCodePanel() {
  const router = useRouter()
  const [message, setMessage] = useState("Choose organization.")
  const [pendingSlug, setPendingSlug] = useState("")

  async function joinOrganization(slug: string, name: string) {
    setPendingSlug(slug)
    setMessage(`Joining ${name}`)

    const response = await fetch("/api/organizations/join", {
      body: JSON.stringify({ organization: slug }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then((result) => result.json().catch(() => ({ ok: false })))

    setPendingSlug("")

    if (!response.ok) {
      setMessage(response.error || "Organization could not be joined.")
      return
    }

    setMessage(`${name} ready`)
    router.push(`/${response.organizationSlug || slug}?joined=1`)
    router.refresh()
  }

  return (
    <main className={styles.surface}>
      <section className={styles.card}>
        <p className={styles.avatar}>AX</p>
        <p className={styles.kicker}>Join Axis</p>
        <h1>Join organization.</h1>
        <p className={styles.copy}>
          Choose your training group and continue into Axis.
        </p>
        <div className={styles.entryPath} aria-label="Axis entry path">
          <span>sign in</span>
          <span>choose org</span>
          <span>check in</span>
          <span>history</span>
        </div>
        <div className={styles.worlds}>
          {V1_ORGANIZATIONS.map((organization) => (
            <button
              disabled={Boolean(pendingSlug)}
              key={organization.slug}
              onClick={() =>
                joinOrganization(organization.slug, organization.name)
              }
              type="button"
            >
              <strong>{organization.avatar}</strong>
              <span>{organization.name}</span>
            </button>
          ))}
        </div>
        <p className={styles.status}>{message}</p>
      </section>
    </main>
  )
}
