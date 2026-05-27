"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import styles from "./JoinOrganizationPanel.module.css"

export function JoinCodePanel() {
  const router = useRouter()
  const [message, setMessage] = useState("Paste an invite link or code.")

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)
    const value = String(form.get("invite") || "").trim()
    const invitePath = extractInvitePath(value)

    if (!invitePath) {
      setMessage("Invite code not recognized.")
      return
    }

    setMessage("Opening invite.")
    router.push(invitePath)
  }

  return (
    <main className={styles.surface}>
      <section className={styles.card}>
        <p className={styles.avatar}>AX</p>
        <p className={styles.kicker}>Join Axis</p>
        <h1>Enter your team.</h1>
        <p className={styles.copy}>
          Use the invite from your coach or organization. Your first check-in
          starts the history.
        </p>
        <div className={styles.entryPath} aria-label="Axis entry path">
          <span>identity</span>
          <span>organization</span>
          <span>first session</span>
          <span>history</span>
        </div>
        <form className={styles.joinForm} onSubmit={submitInvite}>
          <input
            autoComplete="off"
            name="invite"
            placeholder="Paste invite link or code"
            spellCheck={false}
          />
          <button type="submit">Continue</button>
        </form>
        <div className={styles.worlds}>
          <span>Bridge</span>
          <span>City 2 City</span>
        </div>
        <p className={styles.status}>{message}</p>
      </section>
    </main>
  )
}

function extractInvitePath(value: string) {
  if (!value) return ""

  try {
    const url = new URL(value, "https://ontheaxis.com")
    const org = normalizeSlug(url.searchParams.get("org") || "")
    const code = normalizeCode(url.searchParams.get("code") || "")

    if (org && code) return `/join/${org}/${code}`
  } catch {
    // Fall through to path and raw-code parsing.
  }

  const orgCodeMatch = value.match(/\/join\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)/)
  if (orgCodeMatch?.[1] && orgCodeMatch?.[2]) {
    return `/join/${normalizeSlug(orgCodeMatch[1])}/${normalizeCode(orgCodeMatch[2])}`
  }

  const joinMatch = value.match(/\/join\/([a-zA-Z0-9-]+)/)
  if (joinMatch?.[1]) return `/join/${joinMatch[1]}`

  const uuidMatch = value.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  )
  if (uuidMatch?.[0]) return `/join/${uuidMatch[0]}`

  const rawCode = normalizeCode(value)

  return rawCode ? `/join/${rawCode}` : ""
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40)
}

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64)
}
