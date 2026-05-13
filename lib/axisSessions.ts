import { supabase } from "@/lib/supabaseClient"

export type AxisSession = {
  id: string
  title: string | null
  video_url: string
  file_name: string | null
  created_at: string
}

export type AxisEvent = {
  id: string
  session_id: string
  label: string
  time_seconds: number
  note: string | null
  created_at: string
}

export async function createAxisSession(params: {
  videoUrl: string
  fileName?: string
  title?: string
}) {
  const { data, error } =
    await supabase
      .from("axis_sessions")
      .insert({
        video_url:
          params.videoUrl,
        file_name:
          params.fileName ??
          null,
        title:
          params.title ??
          "Axis Session",
      })
      .select()
      .single()

  if (error) {
    console.error(error)
    throw error
  }

  return data as AxisSession
}

export async function getAxisSession(
  sessionId: string
) {
  const { data, error } =
    await supabase
      .from("axis_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

  if (error) {
    console.error(error)
    throw error
  }

  return data as AxisSession
}

export async function getAxisEvents(
  sessionId: string
) {
  const { data, error } =
    await supabase
      .from("axis_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("time_seconds", {
        ascending: true,
      })

  if (error) {
    console.error(error)
    throw error
  }

  return data as AxisEvent[]
}

export async function createAxisEvent(
  params: {
    sessionId: string
    label: string
    timeSeconds: number
    note?: string
  }
) {
  const { data, error } =
    await supabase
      .from("axis_events")
      .insert({
        session_id:
          params.sessionId,
        label: params.label,
        time_seconds:
          params.timeSeconds,
        note:
          params.note ?? null,
      })
      .select()
      .single()

  if (error) {
    console.error(error)
    throw error
  }

  return data as AxisEvent
}