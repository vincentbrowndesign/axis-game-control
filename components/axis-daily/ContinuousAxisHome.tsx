"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/page.module.css"

type CheckInStatus = "idle" | "saving" | "saved"

type CheckInResponse = {
  checkIn?: {
    id: string
    occurred_at: string
  }
  error?: string
  ok?: boolean
  traceId?: string
}

type HistoryNode = {
  dateLabel: string
  id: string
  title: string
}

type ContinuousAxisHomeProps = {
  checkedInToday: boolean
  history: HistoryNode[]
  lastCheckInLabel: string
  leaderboardPlacement: string
  ritualLabel: string
  streakLabel: string
}

export function ContinuousAxisHome({
  checkedInToday,
  history,
  lastCheckInLabel,
  leaderboardPlacement,
  ritualLabel,
  streakLabel,
}: ContinuousAxisHomeProps) {
  const router = useRouter()
  const [status, setStatus] = useState<CheckInStatus>(
    checkedInToday ? "saved" : "idle"
  )
  const [message, setMessage] = useState("")
  const [completedAt, setCompletedAt] = useState(
    checkedInToday ? ritualLabel : ""
  )

  const actionLabel = useMemo(() => {
    if (status === "saving") return "Saving"
    if (status === "saved") return completedAt || ritualLabel

    return "Check in"
  }, [completedAt, ritualLabel, status])
  const busy = status === "saving"

  async function submitCheckIn() {
    if (busy || status === "saved") return

    setStatus("saving")
    setMessage("Writing today")

    try {
      const response = await fetch("/api/check-in", {
        body: JSON.stringify({
          durationMinutes: 60,
          notes: null,
          workoutType: "Training",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })
      const data = (await response.json().catch(() => ({}))) as CheckInResponse

      console.info("AXIS CHECK-IN", {
        ok: response.ok && Boolean(data.ok),
        status: response.status,
        traceId: data.traceId,
      })

      if (!response.ok || !data.ok || !data.checkIn) {
        setStatus("idle")
        setMessage(data.error || "Check-in could not be saved.")
        return
      }

      const savedLabel = `Checked in - ${formatAttendanceTime(
        data.checkIn.occurred_at
      )}`
      setCompletedAt(savedLabel)
      setStatus("saved")
      setMessage("History updated")
      router.refresh()
    } catch (error) {
      setStatus("idle")
      setMessage(
        error instanceof Error
          ? error.message
          : "Check-in could not be saved."
      )
    }
  }

  return (
    <main className={styles.surface}>
      <section className={styles.operatingShell}>
        <header className={styles.operatingHeader}>
          <div>
            <p className={styles.brand}>Axis</p>
            <h1 className={styles.memberTitle}>Welcome back.</h1>
          </div>
          <div className={styles.topSignals} aria-label="Continuity state">
            <div className={styles.topSignal}>
              <span>streak</span>
              <strong>{streakLabel}</strong>
            </div>
            <div className={styles.topSignal}>
              <span>last</span>
              <strong>{lastCheckInLabel}</strong>
            </div>
            <div className={styles.topSignal}>
              <span>rank</span>
              <strong>{leaderboardPlacement}</strong>
            </div>
          </div>
        </header>

        <section className={styles.ritualCenter} aria-label="Daily check in">
          <div className={styles.ritualCopy}>
            <button
              aria-label={actionLabel}
              className={`${styles.ritualAction} ${
                status === "saved" ? styles.ritualActionComplete : ""
              }`}
              disabled={busy || status === "saved"}
              onClick={submitCheckIn}
              type="button"
            >
              {actionLabel}
            </button>
            <p className={styles.ritualWhisper}>Write your story.</p>
            <p className={styles.inlineStatus}>{message}</p>
          </div>
        </section>

        <section className={styles.continuityBed} aria-label="Axis continuity">
          <div className={styles.historyGrid}>
            {history.length ? (
              history.map((item) => (
                <div className={styles.historyNode} key={item.id}>
                  <span>{item.dateLabel}</span>
                  <strong>{item.title}</strong>
                </div>
              ))
            ) : (
              <div className={styles.emptyHistory}>No history yet.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

function formatAttendanceTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
