"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { CSSProperties } from "react"
import styles from "@/app/page.module.css"

type CheckInStatus = "idle" | "checking" | "history-updated" | "failed"

type CheckInResponse = {
  checkIn?: {
    id: string
    occurred_at: string
  }
  error?: string
  message?: string
  ok?: boolean
  traceId?: string
}

type HistoryNode = {
  dateLabel: string
  id: string
  organizationName: string
  timeLabel: string
  title: string
}

type ContinuityDay = {
  id: string
  label: string
  state: "active" | "complete" | "empty" | "future"
}

type ProgressionCell = {
  id: string
  label: string
  state: "active" | "complete" | "future" | "missed"
}

type HistoryStats = {
  currentMonthParticipation: string
  lastSession: string
  missedDays: string
  totalSessions: string
}

type OrganizationSignal = {
  label: string
  value: string
}

type ContinuousAxisHomeProps = {
  activeTodayLabel: string
  checkedInToday: boolean
  continuityDays: ContinuityDay[]
  history: HistoryNode[]
  historyStats: HistoryStats
  lastCheckInLabel: string
  leaderboardSignal: string
  organizationAvatar?: string
  organizationSignals?: OrganizationSignal[]
  organizationName?: string
  organizationSlug?: string
  leaderboardPlacement: string
  participationSignal: string
  progressionCells: ProgressionCell[]
  ritualLabel: string
  streakDays: number
  streakLabel: string
}

export function ContinuousAxisHome({
  activeTodayLabel,
  checkedInToday,
  continuityDays,
  history,
  historyStats,
  lastCheckInLabel,
  leaderboardSignal,
  organizationAvatar,
  organizationSignals = [],
  organizationName = "Axis",
  organizationSlug,
  leaderboardPlacement,
  participationSignal,
  progressionCells,
  ritualLabel,
  streakDays,
  streakLabel,
}: ContinuousAxisHomeProps) {
  const router = useRouter()
  const [status, setStatus] = useState<CheckInStatus>(
    checkedInToday ? "history-updated" : "idle"
  )
  const [message, setMessage] = useState("")
  const [completedAt, setCompletedAt] = useState(
    checkedInToday ? ritualLabel : ""
  )

  const actionLabel = useMemo(() => {
    if (status === "checking") return "Checking in"
    if (status === "history-updated") return completedAt || ritualLabel

    return "Check in"
  }, [completedAt, ritualLabel, status])
  const busy = status === "checking"
  const pulseCount = Math.min(
    12,
    Math.max(3, history.length + (checkedInToday ? 2 : 1))
  )
  const savedDays = continuityDays.filter((day) => day.state !== "future")
  const weekDays = savedDays.slice(-7)
  const weekCompleteCount = weekDays.filter(
    (day) => day.state === "active" || day.state === "complete"
  ).length
  const monthDays = savedDays.slice(-28)
  const miniHistoryDays = monthDays.slice(-14)
  const todayStateLabel =
    status === "history-updated"
      ? "Checked in"
      : status === "checking"
        ? "Checking in"
        : status === "failed"
          ? "Check-in failed"
          : "Not yet"
  const weekLabel = `${weekCompleteCount}/7 days`
  const monthLabel = historyStats.currentMonthParticipation
  const ringProgress = Math.min(100, Math.max(8, (streakDays / 30) * 100))
  const ringStyle = {
    "--axis-ring-progress": `${ringProgress}%`,
  } as CSSProperties

  async function submitCheckIn() {
    if (busy || status === "history-updated") return

    setStatus("checking")
    setMessage("Checking in")

    try {
      const response = await fetch("/api/check-in", {
        body: JSON.stringify({
          durationMinutes: 60,
          notes: null,
          organizationSlug,
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
        setStatus("failed")
        setMessage(humanCheckInError(data.error))
        return
      }

      const savedLabel = `Checked in - ${formatAttendanceTime(
        data.checkIn.occurred_at
      )}`
      setCompletedAt(savedLabel)
      setStatus("history-updated")
      setMessage(data.message || "History updated")
      router.refresh()
    } catch (error) {
      console.error("AXIS CHECK-IN", {
        error,
        stage: "client-check-in-failed",
      })
      setStatus("failed")
      setMessage("Check-in failed")
    }
  }

  return (
    <main className={styles.surface}>
      <section className={styles.operatingShell}>
        <header className={styles.operatingHeader}>
          <div>
            <p className={styles.brand}>
              {organizationAvatar ? (
                <span className={styles.organizationAvatar} aria-hidden="true">
                  {organizationAvatar}
                </span>
              ) : null}
              {organizationName}
            </p>
            <h1 className={styles.memberTitle}>Welcome back.</h1>
          </div>
          <div className={styles.topSignals} aria-label="Continuity state">
            <div className={styles.topSignal}>
              <span>today</span>
              <strong>{todayStateLabel}</strong>
            </div>
            <div className={styles.topSignal}>
              <span>this week</span>
              <strong>{weekLabel}</strong>
            </div>
            <div className={styles.topSignal}>
              <span>all time</span>
              <strong>{leaderboardPlacement}</strong>
            </div>
          </div>
        </header>

        {organizationSignals.length ? (
          <section className={styles.worldSignals} aria-label="Organization activity">
            {organizationSignals.map((signal) => (
              <div className={styles.worldSignal} key={signal.label}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
              </div>
            ))}
          </section>
        ) : null}

        <section className={styles.activityRail} aria-label="Gym activity">
          <div className={styles.activitySignal}>
            <span className={styles.liveDot} aria-hidden="true" />
            <strong>{participationSignal}</strong>
            <em>active today</em>
          </div>
          <div className={styles.activityMeter} aria-hidden="true">
            {Array.from({ length: 12 }).map((_, index) => (
              <span
                className={index < pulseCount ? styles.activityBarLive : ""}
                key={index}
              />
            ))}
          </div>
          <div className={styles.activitySignal}>
            <span className={styles.boardDot} aria-hidden="true" />
            <strong>{leaderboardSignal}</strong>
            <em>where you stand</em>
          </div>
        </section>

        <section className={styles.centerStage} aria-label="Axis daily rhythm">
          <div className={styles.ritualCenter} aria-label="Daily check in">
            <div className={styles.ritualCopy}>
              <button
                aria-label={actionLabel}
                className={`${styles.ritualAction} ${
                  status === "history-updated"
                    ? styles.ritualActionComplete
                    : ""
                }`}
                disabled={busy || status === "history-updated"}
                onClick={submitCheckIn}
                type="button"
              >
                {actionLabel}
              </button>
              <p className={styles.ritualWhisper}>Write your story.</p>
              <p className={styles.inlineStatus}>{message}</p>
              <div className={styles.ritualMomentum} aria-hidden="true">
                {progressionCells.slice(0, 9).map((cell) => (
                  <span
                    className={
                      cell.state === "complete"
                        ? styles.ritualMomentumComplete
                        : cell.state === "active"
                          ? styles.ritualMomentumActive
                          : styles.ritualMomentumNode
                    }
                    key={cell.id}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={styles.rhythmCluster} aria-label="Continuity objects">
            <div className={styles.rhythmCard}>
              <span>active today</span>
              <strong>{todayStateLabel}</strong>
              <em>{activeTodayLabel}</em>
            </div>

            <div className={`${styles.rhythmCard} ${styles.weekObject}`}>
              <span>this week</span>
              <strong>{weekLabel}</strong>
              <div className={styles.weekStrip} aria-hidden="true">
                {weekDays.map((day) => (
                  <i
                    className={
                      day.state === "complete"
                        ? styles.rhythmBandNodeComplete
                        : day.state === "active"
                          ? styles.rhythmBandNodeActive
                          : styles.rhythmBandNode
                    }
                    key={day.id}
                  />
                ))}
              </div>
            </div>

            <div className={`${styles.rhythmCard} ${styles.historyObject}`}>
              <span>history</span>
              <strong>{monthLabel}</strong>
              <em>{historyStats.totalSessions}</em>
              <div className={styles.miniHistoryGrid} aria-hidden="true">
                {miniHistoryDays.map((day) => (
                  <i
                    className={
                      day.state === "complete"
                        ? styles.miniHistoryComplete
                        : day.state === "active"
                          ? styles.miniHistoryActive
                          : styles.miniHistoryEmpty
                    }
                    key={day.id}
                  />
                ))}
              </div>
            </div>

            <div className={`${styles.rhythmCard} ${styles.streakObject}`}>
              <div>
                <span>current streak</span>
                <strong>{streakLabel}</strong>
                <em>{leaderboardPlacement}</em>
              </div>
              <div className={styles.streakRing} style={ringStyle}>
                <strong>{streakDays}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.continuityBed} aria-label="Axis continuity">
          <div className={styles.continuityHeader}>
            <span>History</span>
            <strong>{history.length ? "saved" : "ready"}</strong>
          </div>

          <div className={styles.continuitySurface}>
            <div className={styles.streakCalendar} aria-label="Streak calendar">
              {continuityDays.map((day) => (
                <span
                  className={`${styles.calendarDay} ${
                    day.state === "complete"
                      ? styles.calendarDayComplete
                      : day.state === "active"
                        ? styles.calendarDayActive
                        : day.state === "future"
                          ? styles.calendarDayFuture
                          : ""
                  }`}
                  key={day.id}
                >
                  {day.label}
                </span>
              ))}
            </div>

            <div className={styles.progressionSurface}>
              <div className={styles.historyStats} aria-label="History records">
                <div className={styles.historyStat}>
                  <span>last session</span>
                  <strong>{historyStats.lastSession}</strong>
                </div>
                <div className={styles.historyStat}>
                  <span>this month</span>
                  <strong>{historyStats.currentMonthParticipation}</strong>
                </div>
                <div className={styles.historyStat}>
                  <span>missed days</span>
                  <strong>{historyStats.missedDays}</strong>
                </div>
              </div>
              <div className={styles.progressionGrid} aria-label="Progression grid">
                {progressionCells.map((cell) => (
                  <span
                    aria-label={`${cell.label} ${cell.state}`}
                    className={
                      cell.state === "complete"
                        ? styles.progressionCellComplete
                        : cell.state === "active"
                          ? styles.progressionCellActive
                          : cell.state === "future"
                            ? styles.progressionCellFuture
                            : cell.state === "missed"
                              ? styles.progressionCellMissed
                              : styles.progressionCell
                    }
                    key={cell.id}
                  />
                ))}
              </div>
              <div className={styles.historyGrid}>
                {history.length ? (
                  history.slice(0, 4).map((item, index) => (
                    <div
                      className={`${styles.historyNode} ${
                        index === 0 ? styles.historyNodeActive : ""
                      }`}
                      key={item.id}
                    >
                      <span>{item.dateLabel}</span>
                      <strong>{item.title}</strong>
                      <em>
                        {item.organizationName} - {item.timeLabel}
                      </em>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyHistory}>No history yet.</div>
                )}
              </div>
            </div>
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

function humanCheckInError(value?: string) {
  if (!value) return "Check-in failed"

  if (value.toLowerCase().includes("organization")) {
    return "Organization not ready"
  }

  if (value.toLowerCase().includes("sign in")) {
    return "Sign in required"
  }

  return "Check-in failed"
}
