"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/page.module.css"

type TrainCheckInButtonProps = {
  activeThisWeek: number
  currentStreak: number
  durationSeconds: number
  organizationName: string
  organizationSlug: string
  sessionCompletedAt: string | null
  sessionId: string | null
  sessionStartedAt: string | null
}

type SessionResponse = {
  error?: string
  ok?: boolean
  session?: {
    duration_seconds?: number
    ended_at?: string | null
    id?: string
    started_at?: string
    status?: string
  }
}

export function TrainCheckInButton({
  activeThisWeek,
  currentStreak,
  durationSeconds,
  organizationName,
  organizationSlug,
  sessionCompletedAt,
  sessionId,
  sessionStartedAt,
}: TrainCheckInButtonProps) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState(sessionId)
  const [startedAt, setStartedAt] = useState(sessionStartedAt)
  const [completedAt, setCompletedAt] = useState(sessionCompletedAt)
  const [completedSeconds, setCompletedSeconds] = useState(durationSeconds)
  const [error, setError] = useState("")
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setActiveSessionId(sessionId)
    setStartedAt(sessionStartedAt)
    setCompletedAt(sessionCompletedAt)
    setCompletedSeconds(durationSeconds)
  }, [durationSeconds, sessionCompletedAt, sessionId, sessionStartedAt])

  useEffect(() => {
    if (!startedAt || completedAt) return

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [completedAt, startedAt])

  async function handleCheckIn() {
    if (startedAt || completedAt || isChecking) return

    setError("")
    setIsChecking(true)

    try {
      const response = await fetch(`/api/org/${organizationSlug}/check-in`, {
        method: "POST",
      })
      const payload = (await response.json()) as SessionResponse
      const session = payload.session

      if (!response.ok || !payload.ok || !session?.started_at) {
        setError("Unable to start session.")
        return
      }

      setActiveSessionId(session.id || null)
      setStartedAt(session.started_at)
      setCompletedAt(session.ended_at || null)
      setCompletedSeconds(Number(session.duration_seconds || 0))
      router.refresh()
    } catch (error) {
      console.error("AXIS START SESSION FAILED", error)
      setError("Unable to start session.")
    } finally {
      setIsChecking(false)
    }
  }

  async function handleEndSession() {
    if (!startedAt || completedAt || isEnding) return

    setError("")
    setIsEnding(true)

    try {
      const response = await fetch(`/api/org/${organizationSlug}/check-out`, {
        body: JSON.stringify({ sessionId: activeSessionId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })
      const payload = (await response.json()) as SessionResponse
      const session = payload.session

      if (!response.ok || !payload.ok || !session?.ended_at) {
        setError("Unable to end session.")
        return
      }

      setActiveSessionId(session.id || activeSessionId)
      setCompletedAt(session.ended_at)
      setCompletedSeconds(Number(session.duration_seconds || 0))
      router.refresh()
    } catch (error) {
      console.error("AXIS END SESSION FAILED", error)
      setError("Unable to end session.")
    } finally {
      setIsEnding(false)
    }
  }

  const isComplete = Boolean(completedAt)
  const isInSession = Boolean(startedAt && !completedAt)
  const label = isComplete
    ? "HISTORY UPDATED"
    : isInSession
      ? "CHECK OUT"
      : isChecking
      ? "CHECKING IN"
      : "CHECK IN"
  const statusLabel = isComplete ? "SESSION COMPLETE" : isInSession ? "CHECKED IN" : "READY"
  const elapsedLabel = isComplete
    ? formatDurationSeconds(completedSeconds)
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
          disabled={isChecking}
          onClick={handleCheckIn}
          type="button"
        >
          <span className={styles.trainSessionLabel}>{label}</span>
        </button>
      ) : isInSession ? (
        <div className={styles.trainSessionLive}>
          <span>PARTICIPATING</span>
          <button
            disabled={isEnding}
            onClick={handleEndSession}
            type="button"
          >
            {isEnding ? "CHECKING OUT" : label}
          </button>
        </div>
      ) : (
        <div className={styles.trainSessionComplete}>
          <p>
            <span>DURATION</span>
            <strong>{formatDurationSeconds(completedSeconds)}</strong>
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

function formatDurationSeconds(value: number) {
  if (!value) return "0s"

  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60

  if (hours > 0) return `${hours}h ${padTime(minutes)}m`
  if (minutes > 0) return `${minutes}m ${padTime(seconds)}s`

  return `${seconds}s`
}

function padTime(value: number) {
  return String(value).padStart(2, "0")
}
