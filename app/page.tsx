import Link from "next/link"
import { redirect } from "next/navigation"
import UploadConsole from "@/components/UploadConsole"
import {
  normalizeSessions,
  playerName,
} from "@/lib/archive/sessionRollup"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { AxisProfile, AxisReplaySession } from "@/types/memory"

type Props = {
  searchParams?: Promise<{
    warmup?: string
  }>
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
            Axis
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Record the moment. Replay the sentence.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Save clips, speak naturally, and let players watch the behavior again.
          </p>
          <Link
            href="/auth"
            className="mt-8 w-fit border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-white/70 transition hover:border-white/35 hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const { data: profile } = await supabase
    .from("axis_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<AxisProfile>()

  if (!profile?.player_name || !profile.role) {
    redirect("/profile?next=/")
  }

  const { data } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12)
    .returns<AxisReplaySession[]>()

  const rowsWithUrls = await Promise.all(
    (data || []).map(async (session) => {
      if (session.file_path) {
        const signed = await supabaseAdmin.storage
          .from("axis-replays")
          .createSignedUrl(session.file_path, 60 * 60 * 24 * 7)

        session.video_url = signed.data?.signedUrl || session.video_url
      }

      return session
    })
  )
  const sessions = normalizeSessions(rowsWithUrls)
  const recentPlayers = [
    ...new Set(sessions.map(playerName).filter(Boolean)),
  ].slice(0, 8)

  return (
    <UploadConsole
      email={user.email}
      twinName={profile.player_name || profile.display_name}
      initialWarmupId={params?.warmup}
      recentClips={sessions}
      recentPlayers={recentPlayers}
    />
  )
}
