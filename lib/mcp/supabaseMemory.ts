import type { createClient } from "@/lib/supabase/server"
import type { AxisReplaySession, AxisVoiceNote } from "@/types/memory"

type SupabaseMemoryClient = Awaited<ReturnType<typeof createClient>>

export async function retrieveVoiceNoteMemory({
  supabase,
  userId,
  limit = 200,
}: {
  supabase: SupabaseMemoryClient
  userId: string
  limit?: number
}) {
  return supabase
    .from("axis_voice_notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AxisVoiceNote[]>()
}

export async function retrieveSessionMemory({
  supabase,
  userId,
  limit = 80,
}: {
  supabase: SupabaseMemoryClient
  userId: string
  limit?: number
}) {
  return supabase
    .from("axis_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AxisReplaySession[]>()
}

export function playerNamesFromSessions(sessions: AxisReplaySession[]) {
  return [
    ...new Set(
      sessions
        .map((session) => session.player_name || session.title || "")
        .map((name) => name.trim())
        .filter(Boolean)
    ),
  ]
}
