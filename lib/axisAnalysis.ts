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

function round(value: number) {
  return Math.round(value * 10) / 10
}

export function buildSessionAnalysis(
  sessionId: string,
  events: AxisEvent[]
) {
  const sorted = [...events].sort(
    (a, b) => a.time_seconds - b.time_seconds
  )

  const gaps = sorted
    .slice(1)
    .map((event, index) =>
      event.time_seconds - sorted[index].time_seconds
    )
    .filter((gap) => gap >= 0)

  const averageGap =
    gaps.length > 0
      ? round(
          gaps.reduce((sum, gap) => sum + gap, 0) /
            gaps.length
        )
      : null

  const longestGap =
    gaps.length > 0 ? round(Math.max(...gaps)) : null

  const shortestGap =
    gaps.length > 0 ? round(Math.min(...gaps)) : null

  const passCount = sorted.filter(
    (event) => event.label === "PASS"
  ).length

  const driveCount = sorted.filter(
    (event) => event.label === "DRIVE"
  ).length

  const shotCount = sorted.filter(
    (event) => event.label === "SHOT"
  ).length

  const stopCount = sorted.filter(
    (event) => event.label === "STOP"
  ).length

  let tempoLabel = "not enough data"

  if (averageGap !== null) {
    if (averageGap <= 2.5) tempoLabel = "fast"
    else if (averageGap <= 5) tempoLabel = "balanced"
    else tempoLabel = "slow"
  }

  const summary =
    sorted.length < 2
      ? "Not enough events yet. Add more tags to read the session."
      : `This sequence had ${sorted.length} tagged moments. Average event gap was ${averageGap}s. Tempo reads ${tempoLabel}.`

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

  if (error) {
    console.error(error)
    throw error
  }

  return data as AxisSessionAnalysis
}

export async function getLatestSessionAnalysis(
  sessionId: string
) {
  const { data, error } = await supabase
    .from("axis_session_analysis")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(error)
    throw error
  }

  return data as AxisSessionAnalysis | null
}