import { supabase } from "@/lib/supabaseClient"
import { AxisEvent } from "@/lib/axisSessions"

export type AxisSessionAnalysis = {
  id: string
  session_id: string
  event_count: number
  pass_count: number
  drive_count: number
  shot_count: number
  stop_count: number
  average_gap_seconds: number | null
  longest_gap_seconds: number | null
  shortest_gap_seconds: number | null
  tempo_label: string | null
  summary: string | null
  created_at: string
}

type PerceptionNote = {
  time?: string
  space?: string
  balance?: string
  pressure?: string
  result?: string
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function parseNote(note: string | null): PerceptionNote {
  if (!note) return {}

  try {
    return JSON.parse(note) as PerceptionNote
  } catch {
    return {}
  }
}

function getTempoLabel(averageGap: number | null) {
  if (averageGap === null) return "NO READ"
  if (averageGap <= 2) return "FAST FLOW"
  if (averageGap <= 4.5) return "LIVE POSSESSION"
  return "STALLED"
}

function buildSummary(events: AxisEvent[], averageGap: number | null) {
  const sorted = [...events].sort(
    (a, b) => a.time_seconds - b.time_seconds
  )

  const labels = sorted.map((event) => event.label)
  const shot = sorted.find((event) => event.label === "SHOT")
  const shotNote = parseNote(shot?.note ?? null)

  const hasDriveShot =
    labels.includes("DRIVE") && labels.includes("SHOT")

  const passCount = labels.filter((label) => label === "PASS").length

  if (shotNote.result === "MAKE") {
    return "Advantage converted. Possession produced a clean result."
  }

  if (shotNote.result === "MISS") {
    if (shotNote.pressure === "contested") {
      return "Shot came under pressure. Possession reached a finish, but the window was contested."
    }

    if (shotNote.space === "open") {
      return "Good window created. Shot missed, but the possession produced usable space."
    }

    return "Possession reached an outcome, but the finish window was not clean."
  }

  if (labels.includes("TURNOVER")) {
    return "Possession broke before a shot window formed."
  }

  if (hasDriveShot && averageGap !== null && averageGap <= 2) {
    return "Drive compressed the possession into a quick finish window."
  }

  if (passCount >= 2 && averageGap !== null && averageGap <= 3) {
    return "Ball movement stayed ahead of the defensive reset."
  }

  if (averageGap !== null && averageGap > 4.5) {
    return "Possession slowed before advantage formed."
  }

  return "Possession maintained movement through sequence."
}

export function buildSessionAnalysis(sessionId: string, events: AxisEvent[]) {
  const sorted = [...events].sort(
    (a, b) => a.time_seconds - b.time_seconds
  )

  const gaps = sorted
    .slice(1)
    .map((event, index) => event.time_seconds - sorted[index].time_seconds)
    .filter((gap) => gap >= 0)

  const averageGap =
    gaps.length > 0
      ? round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)
      : null

  const longestGap = gaps.length > 0 ? round(Math.max(...gaps)) : null
  const shortestGap = gaps.length > 0 ? round(Math.min(...gaps)) : null

  const passCount = sorted.filter((event) => event.label === "PASS").length
  const driveCount = sorted.filter((event) => event.label === "DRIVE").length
  const shotCount = sorted.filter((event) => event.label === "SHOT").length
  const stopCount = sorted.filter(
    (event) => event.label === "STOP" || event.label === "TURNOVER"
  ).length

  const tempoLabel = getTempoLabel(averageGap)
  const summary = buildSummary(sorted, averageGap)

  return {
    session_id: sessionId,
    event_count: sorted.length,
    pass_count: passCount,
    drive_count: driveCount,
    shot_count: shotCount,
    stop_count: stopCount,
    average_gap_seconds: averageGap,
    longest_gap_seconds: longestGap,
    shortest_gap_seconds: shortestGap,
    tempo_label: tempoLabel,
    summary,
  }
}

export async function saveSessionAnalysis(
  analysis: ReturnType<typeof buildSessionAnalysis>
) {
  const { data, error } = await supabase
    .from("axis_session_analysis")
    .insert(analysis)
    .select()
    .single()

  if (error) throw error

  return data as AxisSessionAnalysis
}

export async function getLatestSessionAnalysis(sessionId: string) {
  const { data, error } = await supabase
    .from("axis_session_analysis")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data as AxisSessionAnalysis | null
}