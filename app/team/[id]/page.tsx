import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
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
import type { AxisReplaySession } from "@/types/memory"

type Props = {
  params: Promise<{
    id: string
  }>
}

function PrimaryNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
      <Link className="border border-white/10 px-3 py-2 hover:text-white" href="/">
        Home
      </Link>
      <Link className="border border-white/10 px-3 py-2 hover:text-white" href="/sessions">
        Archive
      </Link>
      <Link className="border border-white/10 px-3 py-2 text-white" href="/team/local">
        Team
      </Link>
    </nav>
  )
}

export default async function TeamPage({ params }: Props) {
  await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
            Team
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to review the team.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            See players, recent sessions, notes, and clips tagged for repeat work.
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

  const { data } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<AxisReplaySession[]>()

  const sessions = normalizeSessions(data)
  const tags = tagCounts(sessions)
  const repeats = repeatCounts(sessions)
  const players = playerSummaries(sessions)
  const recentSessions = sessions.filter(isRecent)
  const taggedRepeats = sessions.filter((session) =>
    isRepeated(session, repeats, tags)
  )
  const coachNotes = sessions.filter((session) => session.coachNote).slice(0, 6)

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Team
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              Team review
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              Roster, recent sessions, coach notes, and repeat clips in one place.
            </p>
          </div>
          <PrimaryNav />
        </header>

        <section className="mb-6 grid gap-3 md:grid-cols-4">
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Players
            </p>
            <p className="mt-2 text-3xl font-black">{players.length}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Sessions
            </p>
            <p className="mt-2 text-3xl font-black">{sessions.length}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Recent
            </p>
            <p className="mt-2 text-3xl font-black">{recentSessions.length}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Repeat
            </p>
            <p className="mt-2 text-3xl font-black">{taggedRepeats.length}</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4">
            <section className="border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Roster
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {players.map((player) => (
                  <Link
                    key={player.name}
                    href={`/sessions?player=${encodeURIComponent(player.name)}`}
                    className="border border-white/10 bg-black/35 p-4 transition hover:border-white/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{player.name}</p>
                        <p className="mt-1 text-sm text-white/45">
                          Last practice: {player.lastPractice}
                        </p>
                      </div>
                      <span className="text-sm font-black text-white">
                        {player.sessions}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
                      <span>{player.recentSessions} recent</span>
                      <span>{player.streak} day streak</span>
                    </div>
                  </Link>
                ))}
                {players.length === 0 && (
                  <p className="text-sm text-white/45">No players yet.</p>
                )}
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                  Recent sessions
                </h2>
                <Link href="/sessions" className="text-xs font-bold text-white/45 hover:text-white">
                  Review clips
                </Link>
              </div>
              <div className="mt-4 grid gap-3">
                {sessions.slice(0, 6).map((session) => (
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
          </div>

          <aside className="grid h-fit gap-4">
            <section className="border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Coach notes
              </h2>
              <div className="mt-4 grid gap-3">
                {coachNotes.map((session) => (
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
                {coachNotes.length === 0 && (
                  <p className="text-sm text-white/45">No coach notes yet.</p>
                )}
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Repeat clips
              </h2>
              <div className="mt-4 grid gap-3">
                {taggedRepeats.slice(0, 6).map((session) => (
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
                {taggedRepeats.length === 0 && (
                  <p className="text-sm text-white/45">No repeat clips yet.</p>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
