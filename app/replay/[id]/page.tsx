import AxisReplayClient from "@/components/AxisReplayClient"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  mapReplaySession,
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

      const { count } = await supabase
        .from("axis_sessions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", user.id)
        .eq("player_name", data.player_name || "Unassigned")

      initialSession = {
        ...mapReplaySession(data),
        memoryCount: count || 1,
        ambientLine:
          (count || 0) > 1
            ? "Previous session located."
            : "Replay added to archive.",
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
