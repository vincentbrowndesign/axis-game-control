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
  const [message, setMessage] = useState("Choose Bridge or City 2 City.")
  const [pendingSlug, setPendingSlug] = useState("")
  const [selectedSlug, setSelectedSlug] = useState("")

  function selectOrganization(slug: string, name: string) {
    setSelectedSlug(slug)
    setMessage(`${name} active`)
  }

  async function continueOrganization(slug: string, name: string) {
    setPendingSlug(slug)
    setMessage(`Entering ${name}`)

    const response = await fetch("/api/organizations/join", {
      body: JSON.stringify({ organization: slug }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then((result) => result.json().catch(() => ({ ok: false })))

    setPendingSlug("")

    if (!response.ok || response.persisted !== true) {
      setMessage(response.error || "Organization membership was not saved.")
      return
    }

    setMessage(`${name} saved`)
    router.push(`/player/check-in?org=${response.organizationSlug || slug}&joined=1`)
    router.refresh()
  }

  return (
    <main className={styles.surface}>
      <section className={styles.card}>
        <p className={styles.avatar}>AX</p>
        <p className={styles.kicker}>Player system</p>
        <h1>Build history.</h1>
        <div className={styles.worlds}>
          {V1_ORGANIZATIONS.map((organization) => (
            <button
              className={
                selectedSlug === organization.slug ? styles.worldActive : ""
              }
              disabled={Boolean(pendingSlug)}
              key={organization.slug}
              onClick={() => selectOrganization(organization.slug, organization.name)}
              type="button"
            >
              <strong>{organization.avatar}</strong>
              <span>{organization.name}</span>
            </button>
          ))}
        </div>
        {selectedSlug ? (
          <button
            className={styles.continueButton}
            disabled={Boolean(pendingSlug)}
            onClick={() => {
              const organization = V1_ORGANIZATIONS.find(
                (candidate) => candidate.slug === selectedSlug
              )

              if (organization) {
                continueOrganization(organization.slug, organization.name)
              }
            }}
            type="button"
          >
            {pendingSlug
              ? "Entering"
              : `Continue into ${
                  V1_ORGANIZATIONS.find(
                    (organization) => organization.slug === selectedSlug
                  )?.name || "organization"
                }`}
          </button>
        ) : null}
        <p className={styles.status}>{message}</p>
      </section>
    </main>
  )
}
