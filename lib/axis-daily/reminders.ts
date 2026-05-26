import type { AxisLeaderboardCategory } from "@/lib/axis-daily/leaderboard"
import type { AxisAttendanceSummary } from "@/lib/axis-daily/attendance"

export type AxisContinuityReminder = {
  id: string
  label: string
  tone: "active" | "calm" | "watch"
  value: string
}

export function buildContinuityReminders({
  activeTodayCount,
  checkedInToday,
  leaderboard,
  organizationName = "Axis",
  summary,
}: {
  activeTodayCount: number
  checkedInToday: boolean
  leaderboard: AxisLeaderboardCategory[]
  organizationName?: string
  summary: AxisAttendanceSummary | null
}) {
  const reminders: AxisContinuityReminder[] = []
  const pauseDays = daysSinceLastCheckIn(summary)
  const weeklyLeader = leaderboard.find(
    (category) => category.id === "hours-this-week"
  )?.entries[0]

  if (checkedInToday) {
    reminders.push({
      id: "streak-active",
      label: "streak",
      tone: "active",
      value: "Your streak is active.",
    })
  } else if (pauseDays > 1) {
    reminders.push({
      id: "history-paused",
      label: "history",
      tone: "watch",
      value: `History paused for ${pauseDays} days.`,
    })
  } else {
    reminders.push({
      id: "return-today",
      label: "today",
      tone: "calm",
      value: "Your history is waiting.",
    })
  }

  reminders.push({
    id: "organization-active",
    label: "organization",
    tone: activeTodayCount > 0 ? "active" : "calm",
    value: activeTodayCount
      ? `${organizationName} has ${activeTodayCount} active today.`
      : `${organizationName} is quiet right now.`,
  })

  if (weeklyLeader) {
    reminders.push({
      id: "weekly-leader",
      label: "leaderboard",
      tone: "calm",
      value: `${weeklyLeader.label} leads this week.`,
    })
  }

  return reminders.slice(0, 3)
}

function daysSinceLastCheckIn(summary: AxisAttendanceSummary | null) {
  const lastCheckIn = summary?.checkIns[0]
  if (!lastCheckIn) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const last = new Date(lastCheckIn.occurred_at)
  last.setHours(0, 0, 0, 0)

  return Math.max(
    0,
    Math.floor((today.getTime() - last.getTime()) / 86_400_000)
  )
}
