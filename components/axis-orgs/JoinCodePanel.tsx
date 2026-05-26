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
    const token = extractInviteToken(value)

    if (!token) {
      setMessage("Invite code not recognized.")
      return
    }

    setMessage("Opening invite.")
    router.push(`/join/${token}`)
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
          <span>BTC</span>
          <span>Bridge</span>
          <span>City 2 City</span>
        </div>
        <p className={styles.status}>{message}</p>
      </section>
    </main>
  )
}

function extractInviteToken(value: string) {
  if (!value) return ""

  const joinMatch = value.match(/\/join\/([a-zA-Z0-9-]+)/)
  if (joinMatch?.[1]) return joinMatch[1]

  const uuidMatch = value.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  )
  if (uuidMatch?.[0]) return uuidMatch[0]

  return value.replace(/[^a-zA-Z0-9-]/g, "")
}
