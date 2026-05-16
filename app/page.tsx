import Link from "next/link"
import { redirect } from "next/navigation"
import UploadConsole from "@/components/UploadConsole"
import {
  isRepeated,
  normalizeSessions,
  repeatCounts,
  tagCounts,
  triggerLabel,
} from "@/lib/archive/sessionRollup"
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
            Basketball film, notes, and team review.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Save sessions, find useful clips, and keep practice work organized.
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

  const sessions = normalizeSessions(data)
  const tags = tagCounts(sessions)
  const repeats = repeatCounts(sessions)
  const pendingReview = sessions.filter((session) => !session.coachNote).slice(0, 4)
  const repeatSessions = sessions
    .filter((session) => isRepeated(session, repeats, tags))
    .slice(0, 4)
  const recentTriggers = [
    ...new Set(
      sessions
        .map(triggerLabel)
        .filter((trigger) => trigger.length > 0)
    ),
  ].slice(0, 7)

  return (
    <UploadConsole
      email={user.email}
      twinName={profile.player_name || profile.display_name}
      initialWarmupId={params?.warmup}
      recentTriggers={recentTriggers}
      repeatCount={repeatSessions.length}
      reviewCount={pendingReview.length}
    />
  )
}
