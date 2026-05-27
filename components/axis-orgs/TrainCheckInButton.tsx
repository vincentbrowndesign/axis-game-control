"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/page.module.css"

type TrainCheckInButtonProps = {
  organizationSlug: string
  sessionStartedAt: string | null
}

type CheckInResponse = {
  activeSession?: {
    started_at?: string
    status?: string
  }
  checkIn?: {
    checked_in_at?: string
  }
  error?: string
  ok?: boolean
}

export function TrainCheckInButton({
  organizationSlug,
  sessionStartedAt,
}: TrainCheckInButtonProps) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [startedAt, setStartedAt] = useState(sessionStartedAt)
  const [error, setError] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!startedAt) return

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [startedAt])

  async function handleCheckIn() {
    if (startedAt || isChecking || isPending) return

    setError("")
    setIsChecking(true)

    try {
      const response = await fetch(`/api/org/${organizationSlug}/check-in`, {
        method: "POST",
      })
      const payload = (await response.json()) as CheckInResponse

      const savedSessionStart =
        payload.activeSession?.started_at || payload.checkIn?.checked_in_at

      if (!response.ok || !payload.ok || !savedSessionStart) {
        setError("Session could not be started. Try again.")
        return
      }

      setStartedAt(savedSessionStart)
      startTransition(() => router.refresh())
    } catch {
      setError("Session could not be started. Try again.")
    } finally {
      setIsChecking(false)
    }
  }

  const label = startedAt
    ? "IN SESSION"
    : isChecking || isPending
      ? "STARTING SESSION"
      : "START SESSION"

  return (
    <div className={styles.trainCheckInControl}>
      <button
        className={styles.trainCheckInButton}
        disabled={Boolean(startedAt) || isChecking || isPending}
        onClick={handleCheckIn}
        type="button"
      >
        {label}
      </button>
      {startedAt ? (
        <div className={styles.trainSessionMeta} aria-label="Active session">
          <span>
            <em />
            ACTIVE
          </span>
          <strong>{formatElapsedTime(startedAt, now)}</strong>
          <small>START {formatSessionTime(startedAt)}</small>
        </div>
      ) : null}
      {error ? <p className={styles.trainCheckInError}>{error}</p> : null}
    </div>
  )
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatElapsedTime(value: string, now: number) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 1000),
  )
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  if (hours > 0) {
    return `${hours}:${padTime(minutes)}:${padTime(seconds)}`
  }

  return `${minutes}:${padTime(seconds)}`
}

function padTime(value: number) {
  return String(value).padStart(2, "0")
}
