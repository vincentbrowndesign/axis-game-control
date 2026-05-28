"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { AxisWorkUnit } from "@/lib/axis-orgs/check-ins"
import styles from "@/app/page.module.css"

type TrainCheckInButtonProps = {
  activeThisWeek: number
  currentStreak: number
  durationMinutes: number
  sessionId: string | null
  organizationName: string
  organizationSlug: string
  sessionCompletedAt: string | null
  sessionStartedAt: string | null
  workUnits: AxisWorkUnit[]
}

type CheckInResponse = {
  activeSession?: {
    id?: string
    started_at?: string
    status?: string
  }
  checkIn?: {
    checked_in_at?: string
    id?: string
  }
  error?: string
  ok?: boolean
}

type CheckOutResponse = {
  checkIn?: {
    checked_out_at?: string | null
    duration_minutes?: number | null
    work_units?: AxisWorkUnit[]
  }
  error?: string
  ok?: boolean
}

const BASKETBALL_WORK_UNITS: AxisWorkUnit[] = [
  {
    completed: false,
    duration_minutes: 8,
    makes: 0,
    name: "Ball Handles",
    reps: 30,
    sets: 3,
  },
  {
    completed: false,
    duration_minutes: 10,
    makes: 0,
    name: "Free Throws",
    reps: 10,
    sets: 5,
  },
  {
    completed: false,
    duration_minutes: 12,
    makes: 0,
    name: "Form Shooting",
    reps: 25,
    sets: 4,
  },
  {
    completed: false,
    duration_minutes: 10,
    makes: 0,
    name: "Layups",
    reps: 20,
    sets: 4,
  },
  {
    completed: false,
    duration_minutes: 8,
    makes: 0,
    name: "Sprints",
    reps: 1,
    sets: 6,
  },
]

export function TrainCheckInButton({
  activeThisWeek,
  currentStreak,
  durationMinutes,
  sessionId,
  organizationName,
  organizationSlug,
  sessionCompletedAt,
  sessionStartedAt,
  workUnits,
}: TrainCheckInButtonProps) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [startedAt, setStartedAt] = useState(sessionStartedAt)
  const [completedAt, setCompletedAt] = useState(sessionCompletedAt)
  const [completedMinutes, setCompletedMinutes] = useState(durationMinutes)
  const [activeCheckInId, setActiveCheckInId] = useState(sessionId)
  const [workState, setWorkState] = useState(() =>
    workUnits.length ? workUnits : BASKETBALL_WORK_UNITS
  )
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
      console.info("AXIS START SESSION CLICK", {
        organizationSlug,
      })

      const response = await fetch(`/api/org/${organizationSlug}/check-in`, {
        method: "POST",
      })
      const payload = (await response.json()) as CheckInResponse

      const savedSessionStart =
        payload.activeSession?.started_at || payload.checkIn?.checked_in_at
      const savedSessionId = payload.activeSession?.id || payload.checkIn?.id || null

      if (!response.ok || !payload.ok || !savedSessionStart) {
        console.error("AXIS START SESSION FAILED", {
          payload,
          status: response.status,
          statusText: response.statusText,
        })
        setError("Unable to start session.")
        return
      }

      setStartedAt(savedSessionStart)
      setCompletedAt(null)
      setCompletedMinutes(0)
      setActiveCheckInId(savedSessionId)
      setWorkState(BASKETBALL_WORK_UNITS)
      startTransition(() => router.refresh())
    } catch (error) {
      console.error("AXIS START SESSION FAILED", error)
      setError("Unable to start session.")
    } finally {
      setIsChecking(false)
    }
  }

  async function handleEndSession() {
    if (!startedAt || completedAt || isEnding || isPending) return

    setError("")
    setIsEnding(true)

    try {
      console.info("AXIS END SESSION CLICK", {
        checkInId: activeCheckInId,
        organizationSlug,
        workUnitsCount: workState.length,
      })

      const response = await fetch(`/api/org/${organizationSlug}/check-out`, {
        body: JSON.stringify({ checkInId: activeCheckInId, workUnits: workState }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })
      const payload = (await response.json()) as CheckOutResponse
      const savedCompletedAt = payload.checkIn?.checked_out_at

      if (!response.ok || !payload.ok || !savedCompletedAt) {
        console.error("AXIS END SESSION FAILED", {
          payload,
          status: response.status,
          statusText: response.statusText,
        })
        setError("Unable to end session.")
        return
      }

      setCompletedAt(savedCompletedAt)
      setCompletedMinutes(Number(payload.checkIn?.duration_minutes || 0))
      setWorkState(payload.checkIn?.work_units?.length ? payload.checkIn.work_units : workState)
      startTransition(() => router.refresh())
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
  const completedWorkCount = workState.filter((unit) => unit.completed).length

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
      ) : null}
      {startedAt && isInSession ? (
        <section className={styles.workUnitRail} aria-label="Basketball work">
          {workState.map((unit, index) => (
            <article
              className={
                unit.completed ? styles.workUnitComplete : styles.workUnit
              }
              key={unit.name}
            >
              <div className={styles.workUnitName}>
                <strong>{unit.name}</strong>
                <button
                  onClick={() => toggleWorkUnit(index)}
                  type="button"
                >
                  {unit.completed ? "DONE" : "ADD"}
                </button>
              </div>
              <div className={styles.workUnitFields}>
                <label>
                  <span>SETS</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    onChange={(event) =>
                      updateWorkUnit(index, "sets", event.target.value)
                    }
                    type="number"
                    value={unit.sets}
                  />
                </label>
                <label>
                  <span>REPS</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    onChange={(event) =>
                      updateWorkUnit(index, "reps", event.target.value)
                    }
                    type="number"
                    value={unit.reps}
                  />
                </label>
                <label>
                  <span>MAKES</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    onChange={(event) =>
                      updateWorkUnit(index, "makes", event.target.value)
                    }
                    type="number"
                    value={unit.makes}
                  />
                </label>
                <label>
                  <span>MIN</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    onChange={(event) =>
                      updateWorkUnit(index, "duration_minutes", event.target.value)
                    }
                    type="number"
                    value={unit.duration_minutes}
                  />
                </label>
              </div>
            </article>
          ))}
        </section>
      ) : startedAt ? (
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
          <p>
            <span>WORK COMPLETED</span>
            <strong>{completedWorkCount}</strong>
          </p>
        </div>
      ) : null}
      {error ? <p className={styles.trainCheckInError}>{error}</p> : null}
    </div>
  )

  function toggleWorkUnit(index: number) {
    setWorkState((current) =>
      current.map((unit, unitIndex) =>
        unitIndex === index ? { ...unit, completed: !unit.completed } : unit
      )
    )
  }

  function updateWorkUnit(
    index: number,
    field: "duration_minutes" | "makes" | "reps" | "sets",
    value: string
  ) {
    setWorkState((current) =>
      current.map((unit, unitIndex) =>
        unitIndex === index
          ? { ...unit, [field]: cleanWorkInput(value) }
          : unit
      )
    )
  }
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

function cleanWorkInput(value: string) {
  const number = Number(value)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(Math.round(number), 10000))
}
