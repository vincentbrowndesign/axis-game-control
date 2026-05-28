"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/page.module.css"

type TrainCheckInButtonProps = {
  activeThisWeek: number
  currentStreak: number
  durationMinutes: number
  organizationName: string
  organizationSlug: string
  sessionCompletedAt: string | null
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

type CheckOutResponse = {
  checkIn?: {
    checked_out_at?: string | null
    duration_minutes?: number | null
  }
  error?: string
  ok?: boolean
}

export function TrainCheckInButton({
  activeThisWeek,
  currentStreak,
  durationMinutes,
  organizationName,
  organizationSlug,
  sessionCompletedAt,
  sessionStartedAt,
}: TrainCheckInButtonProps) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [startedAt, setStartedAt] = useState(sessionStartedAt)
  const [completedAt, setCompletedAt] = useState(sessionCompletedAt)
  const [completedMinutes, setCompletedMinutes] = useState(durationMinutes)
  const [error, setError] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!startedAt || completedAt) return

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [completedAt, startedAt])

  async function handleCheckIn() {
    if (startedAt || completedAt || isChecking || isPending) return

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
      setCompletedAt(null)
      setCompletedMinutes(0)
      startTransition(() => router.refresh())
    } catch {
      setError("Session could not be started. Try again.")
    } finally {
      setIsChecking(false)
    }
  }

  async function handleEndSession() {
    if (!startedAt || completedAt || isEnding || isPending) return

    setError("")
    setIsEnding(true)

    try {
      const response = await fetch(`/api/org/${organizationSlug}/check-out`, {
        method: "POST",
      })
      const payload = (await response.json()) as CheckOutResponse
      const savedCompletedAt = payload.checkIn?.checked_out_at

      if (!response.ok || !payload.ok || !savedCompletedAt) {
        setError("Session could not be completed. Try again.")
        return
      }

      setCompletedAt(savedCompletedAt)
      setCompletedMinutes(Number(payload.checkIn?.duration_minutes || 0))
      startTransition(() => router.refresh())
    } catch {
      setError("Session could not be completed. Try again.")
    } finally {
      setIsEnding(false)
    }
  }

  const isComplete = Boolean(completedAt)
  const isInSession = Boolean(startedAt && !completedAt)
  const label = isComplete
    ? "SESSION COMPLETE"
    : isInSession
      ? "END SESSION"
      : isChecking || isPending
      ? "STARTING SESSION"
      : "START SESSION"
  const statusLabel = isComplete ? "SESSION COMPLETE" : isInSession ? "IN SESSION" : "READY"
  const elapsedLabel = isComplete
    ? formatDurationMinutes(completedMinutes)
    : startedAt
      ? formatElapsedTime(startedAt, now)
      : "0:00"

  return (
    <div className={styles.trainCheckInControl}>
      <div className={styles.trainSessionTopBar} aria-label="Session status">
        <span>{organizationName}</span>
        <strong>{statusLabel}</strong>
        <em>{elapsedLabel}</em>
      </div>
      {!startedAt ? (
        <button
          className={styles.trainCheckInButton}
          disabled={isChecking || isPending}
          onClick={handleCheckIn}
          type="button"
        >
          <span className={styles.trainSessionLabel}>{label}</span>
        </button>
      ) : isInSession ? (
        <div className={styles.trainSessionLive}>
          <span>TRAINING ACTIVE</span>
          <button
            disabled={isEnding || isPending}
            onClick={handleEndSession}
            type="button"
          >
            {isEnding || isPending ? "ENDING SESSION" : label}
          </button>
        </div>
      ) : (
        <div className={styles.trainSessionComplete}>
          <p>
            <span>DURATION</span>
            <strong>{formatDurationMinutes(completedMinutes)}</strong>
          </p>
          <p>
            <span>CURRENT STREAK</span>
            <strong>{currentStreak} {currentStreak === 1 ? "day" : "days"}</strong>
          </p>
          <p>
            <span>ACTIVE THIS WEEK</span>
            <strong>{activeThisWeek} / 7 days</strong>
          </p>
        </div>
      )}
      {error ? <p className={styles.trainCheckInError}>{error}</p> : null}
    </div>
  )
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

function formatDurationMinutes(value: number) {
  if (!value) return "0m"

  const hours = Math.floor(value / 60)
  const minutes = value % 60

  if (!hours) return `${minutes}m`
  if (!minutes) return `${hours}h`

  return `${hours}h ${String(minutes).padStart(2, "0")}m`
}

function padTime(value: number) {
  return String(value).padStart(2, "0")
}
