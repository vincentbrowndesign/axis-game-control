"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { AxisSessionSegment } from "@/lib/axis-daily/session-flow"
import styles from "@/app/page.module.css"

type CheckInStatus =
  | "checked-out"
  | "checking"
  | "checking-out"
  | "failed"
  | "history-updated"
  | "idle"

type CheckInResponse = {
  checkIn?: {
    checked_out_at?: string | null
    id: string
    occurred_at: string
    reflection?: string | null
    session_segments?: AxisSessionSegment[]
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

type OrganizationCulture = {
  activeSessions: number
  avatar: string
  detail: string
  metric: string
  name: string
  signal: string
  streakLeaderDays: number
  slug: string
  weeklyMembers: number
}

type ContinuityReminder = {
  id: string
  label: string
  tone: "active" | "calm" | "watch"
  value: string
}

type HomeContinuityOption = {
  durationMinutes: number
  label: string
}

type ContinuousAxisHomeProps = {
  activeTodayLabel: string
  checkedOutToday: boolean
  checkedInToday: boolean
  checkoutLabel: string
  continuityDays: ContinuityDay[]
  currentSessionTitle: string
  firstSessionActive: boolean
  history: HistoryNode[]
  historyStats: HistoryStats
  joinedFromOrganization: boolean
  lastCheckInLabel: string
  leaderboardSignal: string
  organizationCulture?: OrganizationCulture[]
  organizationAvatar?: string
  organizationSignals?: OrganizationSignal[]
  organizationName?: string
  organizationSlug?: string
  leaderboardPlacement: string
  participationSignal: string
  progressionCells: ProgressionCell[]
  reminders: ContinuityReminder[]
  ritualLabel: string
  sessionSegments: AxisSessionSegment[]
  streakDays: number
  streakLabel: string
}

export function ContinuousAxisHome({
  activeTodayLabel,
  checkedOutToday,
  checkedInToday,
  checkoutLabel,
  continuityDays,
  currentSessionTitle,
  firstSessionActive,
  history,
  historyStats,
  joinedFromOrganization,
  lastCheckInLabel,
  leaderboardSignal,
  organizationAvatar,
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
    checkedOutToday ? "checked-out" : checkedInToday ? "history-updated" : "idle"
  )
  const [message, setMessage] = useState("")
  const [completedAt, setCompletedAt] = useState(
    checkedOutToday ? checkoutLabel : checkedInToday ? ritualLabel : ""
  )
  const [reflection, setReflection] = useState("")

  const actionLabel = useMemo(() => {
    if (status === "checking") return "Checking in"
    if (status === "checking-out") return "Checking out"
    if (status === "checked-out") return completedAt || checkoutLabel
    if (status === "history-updated") return completedAt || ritualLabel

    return "Check in"
  }, [checkoutLabel, completedAt, ritualLabel, status])
  const busy = status === "checking" || status === "checking-out"
  const todayStateLabel =
    status === "history-updated"
      ? "Checked in"
      : status === "checked-out"
        ? "Checked out"
      : status === "checking"
        ? "Checking in"
        : status === "checking-out"
          ? "Checking out"
        : status === "failed"
          ? "Check-in failed"
          : "Not yet"
  const firstSessionMoment =
    firstSessionActive || (status === "checked-out" && history.length <= 1)
  const onboardingMoment =
    joinedFromOrganization && status === "idle" && history.length === 0

  async function submitCheckIn(homeContinuity?: HomeContinuityOption) {
    if (busy || status === "checked-out") return

    if (status === "history-updated") {
      await submitCheckOut()
      return
    }

    setStatus("checking")
    setMessage("Checking in")

    try {
      const response = await fetch("/api/check-in", {
        body: JSON.stringify({
          durationMinutes: homeContinuity?.durationMinutes || 60,
          notes: homeContinuity ? "Home continuity" : null,
          organizationSlug,
          workoutType: homeContinuity?.label || currentSessionTitle || "Open Gym",
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
      setMessage(homeContinuity ? "Home continuity saved" : data.message || "History updated")
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

  async function submitCheckOut() {
    setStatus("checking-out")
    setMessage("Checking out")

    try {
      const response = await fetch("/api/check-out", {
        body: JSON.stringify({
          organizationSlug,
          reflection,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })
      const data = (await response.json().catch(() => ({}))) as CheckInResponse

      if (!response.ok || !data.ok || !data.checkIn?.checked_out_at) {
        setStatus("history-updated")
        setMessage(humanCheckInError(data.error || "Check-out failed"))
        return
      }

      setCompletedAt(
        `Checked out - ${formatAttendanceTime(data.checkIn.checked_out_at)}`
      )
      setStatus("checked-out")
      setMessage(data.message || "History updated")
      router.refresh()
    } catch (error) {
      console.error("AXIS CHECK-OUT", {
        error,
        stage: "client-check-out-failed",
      })
      setStatus("history-updated")
      setMessage("Check-out failed")
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
          <div className={styles.primarySignal} aria-label="Continuity state">
            <span>{todayStateLabel}</span>
            <strong>{streakLabel}</strong>
            <em>{leaderboardPlacement}</em>
          </div>
        </header>

        {onboardingMoment || firstSessionMoment ? (
          <section className={styles.firstSessionMoment} aria-label="First session">
            <span>{firstSessionMoment ? "first session logged" : "organization joined"}</span>
            <strong>{firstSessionMoment ? "History started." : "First check-in waiting."}</strong>
            <div>
              <em>{firstSessionMoment ? "streak active" : "enter the floor"}</em>
              <em>{firstSessionMoment ? "identity attached" : "history starts here"}</em>
              <em>{firstSessionMoment ? "return tomorrow" : organizationName}</em>
            </div>
          </section>
        ) : null}

        <section className={styles.centerStageMinimal} aria-label="Axis daily rhythm">
          <div className={styles.ritualCenter} aria-label="Daily check in">
            <div className={styles.ritualCopy}>
              <button
                aria-label={actionLabel}
                className={`${styles.ritualAction} ${
                  status === "checked-out" || status === "history-updated"
                    ? styles.ritualActionComplete
                    : ""
                }`}
                disabled={busy || status === "checked-out"}
                onClick={() => submitCheckIn()}
                type="button"
              >
                {actionLabel}
              </button>
              {status === "history-updated" ? (
                <input
                  className={styles.reflectionInput}
                  maxLength={160}
                  onChange={(event) => setReflection(event.target.value)}
                  placeholder="What did you work on?"
                  value={reflection}
                />
              ) : (
                <p className={styles.ritualWhisper}>Write your story.</p>
              )}
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
        </section>

        <section className={styles.continuityBed} aria-label="Axis continuity">
          <div className={styles.continuityHeader}>
            <span>History</span>
            <strong>{history.length ? "growing" : "ready"}</strong>
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

            <div className={styles.retentionRecord} aria-label="Continuity records">
              <div>
                <span>active</span>
                <strong>{participationSignal}</strong>
                <em>{activeTodayLabel}</em>
              </div>
              <div>
                <span>last</span>
                <strong>{historyStats.lastSession}</strong>
                <em>{lastCheckInLabel}</em>
              </div>
              <div>
                <span>rank</span>
                <strong>{leaderboardSignal}</strong>
                <em>{leaderboardPlacement}</em>
              </div>
              <div>
                <span>month</span>
                <strong>{historyStats.currentMonthParticipation}</strong>
                <em>{historyStats.totalSessions}</em>
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

  if (value.toLowerCase().includes("check-out")) {
    return "Check-out failed"
  }

  if (value.toLowerCase().includes("sign in")) {
    return "Sign in required"
  }

  return "Check-in failed"
}
