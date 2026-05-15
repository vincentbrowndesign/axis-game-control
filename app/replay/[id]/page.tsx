import AxisReplayClient from "@/components/AxisReplayClient"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { buildMemoryState } from "@/lib/memoryInference"
import { normalizeReplay } from "@/lib/normalizeReplay"
import {
  type AxisReplaySession,
} from "@/types/memory"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function ReplayPage({
  params,
}: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let initialSession = null

  if (user) {
    const { data } = await supabase
      .from("axis_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle<AxisReplaySession>()

    if (data) {
      if (data.file_path) {
        const signed = await supabaseAdmin.storage
          .from("axis-replays")
          .createSignedUrl(data.file_path, 60 * 60 * 24 * 7)

        data.video_url =
          signed.data?.signedUrl || data.video_url
      }

      const { data: previousData } = await supabase
        .from("axis_sessions")
        .select("*")
        .eq("user_id", user.id)
        .neq("id", id)
        .lt("created_at", data.created_at)
        .order("created_at", { ascending: false })
        .returns<AxisReplaySession[]>()

      const session = normalizeReplay(data)
      const previousSessions = (previousData || []).map(
        normalizeReplay
      )
      const memoryState = buildMemoryState({
        session,
        previousSessions,
        player: session.player,
      })

      initialSession = {
        ...session,
        memoryCount: memoryState.memoryCount,
        lastSignal: memoryState.status,
        archiveStatus: memoryState.archiveStatus,
        context: memoryState.contextLine,
        timeline: memoryState.timelineEvents.map((event) => ({
          time: event.time,
          label: event.label,
          detail: event.body,
          tone: event.tone,
        })),
        ambientLine: memoryState.ambientLine,
        memoryState,
      }
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <AxisReplayClient
        playbackId={id}
        initialSession={initialSession}
      />
    </main>
  )
}
