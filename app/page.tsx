import Link from "next/link"
import { redirect } from "next/navigation"
import UploadConsole from "@/components/UploadConsole"
import {
  drillName,
  isRecent,
  isRepeated,
  normalizeSessions,
  playerName,
  playerSummaries,
  relativeTime,
  repeatCounts,
  tagCounts,
} from "@/lib/archive/sessionRollup"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"
import { createClient } from "@/lib/supabase/server"
import { getWarmupById } from "@/lib/world/getNextWarmup"
import type { AxisProfile, AxisReplaySession } from "@/types/memory"

type Props = {
  searchParams?: Promise<{
    warmup?: string
  }>
}

function PrimaryNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
      <Link className="border border-white/10 px-3 py-2 text-white" href="/">
        Home
      </Link>
      <Link className="border border-white/10 px-3 py-2 hover:text-white" href="/sessions">
        Archive
      </Link>
      <Link className="border border-white/10 px-3 py-2 hover:text-white" href="/team/local">
        Team
      </Link>
    </nav>
  )
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

  const warmup = getWarmupById(params?.warmup)

  if (warmup) {
    return (
      <UploadConsole
        email={user.email}
        twinName={profile.player_name || profile.display_name}
        initialWarmupId={warmup.id}
      />
    )
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
  const recentSessions = sessions.filter(isRecent)
  const pendingReview = sessions.filter((session) => !session.coachNote).slice(0, 4)
  const repeatSessions = sessions
    .filter((session) => isRepeated(session, repeats, tags))
    .slice(0, 4)
  const notes = sessions.filter((session) => session.coachNote).slice(0, 4)
  const players = playerSummaries(sessions)
  const firstPractice = getCalibrationMissions()[0]
  const continueHref = firstPractice ? `/?warmup=${firstPractice.id}` : "/"

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Home
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              Continue now.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              Pick up practice, review recent clips, and check notes that still need attention.
            </p>
          </div>
          <PrimaryNav />
        </header>

        <section className="mb-6 grid gap-3 md:grid-cols-4">
          <Link
            href={continueHref}
            className="border border-lime-300/20 bg-lime-300/10 p-4 transition hover:border-lime-200/40"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-lime-200/75">
              Practice
            </p>
            <p className="mt-2 text-2xl font-black">Continue practice</p>
          </Link>
          <Link
            href="/sessions?view=recent"
            className="border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Recent
            </p>
            <p className="mt-2 text-3xl font-black">{recentSessions.length}</p>
          </Link>
          <Link
            href="/sessions?view=repeated"
            className="border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Repeat
            </p>
            <p className="mt-2 text-3xl font-black">{repeatSessions.length}</p>
          </Link>
          <Link
            href="/team/local"
            className="border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Team
            </p>
            <p className="mt-2 text-3xl font-black">{players.length}</p>
          </Link>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4">
            <section className="border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                  Recent clips
                </h2>
                <Link href="/sessions" className="text-xs font-bold text-white/45 hover:text-white">
                  Open archive
                </Link>
              </div>
              <div className="mt-4 grid gap-3">
                {sessions.slice(0, 5).map((session) => (
                  <Link
                    key={session.id}
                    href={`/replay/${session.id}`}
                    className="grid gap-2 border border-white/10 bg-black/35 p-3 transition hover:border-white/25 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-bold text-white">{drillName(session)}</p>
                      <p className="mt-1 text-sm text-white/45">
                        {playerName(session)} / {session.environment}
                      </p>
                    </div>
                    <p className="text-sm text-white/40">{relativeTime(session.createdAt)}</p>
                  </Link>
                ))}
                {sessions.length === 0 && (
                  <p className="text-sm text-white/45">No sessions yet.</p>
                )}
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Pending review
              </h2>
              <div className="mt-4 grid gap-3">
                {pendingReview.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions?note=&q=${encodeURIComponent(drillName(session))}`}
                    className="border border-white/10 bg-black/35 p-3 transition hover:border-white/25"
                  >
                    <p className="font-bold text-white">{drillName(session)}</p>
                    <p className="mt-1 text-sm text-white/45">
                      Add a coach note for {playerName(session)}.
                    </p>
                  </Link>
                ))}
                {pendingReview.length === 0 && (
                  <p className="text-sm text-white/45">No pending review.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="grid h-fit gap-4">
            <section className="border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Coach notes
              </h2>
              <div className="mt-4 grid gap-3">
                {notes.map((session) => (
                  <Link
                    key={session.id}
                    href={`/replay/${session.id}`}
                    className="border border-white/10 bg-black/35 p-3 transition hover:border-white/25"
                  >
                    <p className="text-sm text-white/75">{session.coachNote}</p>
                    <p className="mt-2 text-xs text-white/35">
                      {playerName(session)} / {drillName(session)}
                    </p>
                  </Link>
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-white/45">No coach notes yet.</p>
                )}
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Tagged repeats
              </h2>
              <div className="mt-4 grid gap-3">
                {repeatSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions?view=repeated&player=${encodeURIComponent(playerName(session))}`}
                    className="border border-white/10 bg-black/35 p-3 transition hover:border-white/25"
                  >
                    <p className="font-bold text-white">{drillName(session)}</p>
                    <p className="mt-1 text-sm text-white/45">
                      {playerName(session)}
                    </p>
                  </Link>
                ))}
                {repeatSessions.length === 0 && (
                  <p className="text-sm text-white/45">No tagged repeats yet.</p>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
