import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  drillName,
  isRepeated,
  normalizeSessions,
  playerName,
  playerSummaries,
  relativeTime,
  repeatCounts,
  tagCounts,
} from "@/lib/archive/sessionRollup"
import type { AxisReplaySession, ReplaySessionView } from "@/types/memory"

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

function sessionText(session: ReplaySessionView) {
  return [session.title, session.mission, session.environment, ...session.tags]
    .join(" ")
    .toLowerCase()
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
  const taggedRepeats = sessions.filter((session) =>
    isRepeated(session, repeats, tags)
  )
  const coachNotes = sessions.filter((session) => session.coachNote).slice(0, 6)
  const needsReview = sessions.filter((session) => !session.coachNote)
  const playerReview = players
    .map((player) => ({
      ...player,
      reviewSession: needsReview.find(
        (session) => playerName(session) === player.name
      ),
      needsNotes: needsReview.filter(
        (session) => playerName(session) === player.name
      ).length,
    }))
    .filter((player) => player.needsNotes > 0)
    .sort((a, b) => b.needsNotes - a.needsNotes)
  const playersForReview = playerReview.length
    ? playerReview
    : players.slice(0, 4).map((player) => ({
        ...player,
        reviewSession: sessions.find(
          (session) => playerName(session) === player.name
        ),
        needsNotes: player.sessions,
      }))
  const recentPractice = sessions.find(
    (session) => session.environment === "practice"
  )
  const lastScrimmage = sessions.find(
    (session) =>
      session.environment === "game" || sessionText(session).includes("scrimmage")
  )

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Team
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Team review
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              Prepare tomorrow from recent sessions, notes, and clips tagged repeat.
            </p>
          </div>
          <PrimaryNav />
        </header>

        <section className="mb-5 grid gap-2 border-b border-white/10 pb-5 text-sm text-white/65 md:grid-cols-2">
          <Link href="/sessions?view=repeated" className="hover:text-white">
            {taggedRepeats.length
              ? `${taggedRepeats.length} repeat clips`
              : "No repeat clips tagged"}
          </Link>
          <Link href="/sessions?note=missing" className="hover:text-white">
            {needsReview.length
              ? `${needsReview.length} notes missing`
              : "Notes are current"}
          </Link>
          <Link
            href={recentPractice ? `/replay/${recentPractice.id}` : "/sessions?type=practice"}
            className="hover:text-white"
          >
            {recentPractice
              ? `Recent practice: ${drillName(recentPractice)}`
              : "No recent practice"}
          </Link>
          <Link
            href={lastScrimmage ? `/replay/${lastScrimmage.id}` : "/sessions?type=scrimmage"}
            className="hover:text-white"
          >
            {lastScrimmage
              ? `Last scrimmage clips: ${playerName(lastScrimmage)}`
              : "No scrimmage clips yet"}
          </Link>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4">
            <section className="border-b border-white/10 pb-4">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Players needing review
              </h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {playersForReview.map((player) => (
                  <Link
                    key={player.name}
                    href={`/sessions?player=${encodeURIComponent(player.name)}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
                  >
                    <p className="font-bold text-white">{player.name}</p>
                    <p className="mt-1 text-sm text-lime-100/80">
                      {player.reviewSession
                        ? `${drillName(player.reviewSession)} needs review`
                        : "Check recent practice work"}
                    </p>
                    {player.reviewSession?.coachNote ? (
                      <p className="mt-1 text-sm text-white/55">
                        {player.reviewSession.coachNote}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
                      <span>{player.needsNotes} notes pending</span>
                      <span>{player.recentSessions} recent</span>
                      <span>last practice {player.lastPractice}</span>
                    </div>
                  </Link>
                ))}
                {players.length === 0 && (
                  <p className="text-sm text-white/45">No players yet.</p>
                )}
              </div>
            </section>

            <section className="border-b border-white/10 pb-4">
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
                    className="grid gap-2 border-t border-white/10 py-3 transition hover:text-white sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="text-sm text-lime-100/80">
                        {session.coachNote ||
                          (isRepeated(session, repeats, tags)
                            ? "Repeat tomorrow"
                            : "Open for review")}
                      </p>
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
            <section className="border-b border-white/10 pb-4">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Coach notes
              </h2>
              <div className="mt-3 grid gap-3">
                {coachNotes.map((session) => (
                  <Link
                    key={session.id}
                    href={`/replay/${session.id}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
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

            <section className="border-b border-white/10 pb-4">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Repeat clips
              </h2>
              <div className="mt-3 grid gap-3">
                {taggedRepeats.slice(0, 6).map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions?view=repeated&player=${encodeURIComponent(playerName(session))}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
                  >
                    <p className="text-sm text-lime-100/80">Repeat tomorrow</p>
                    <p className="mt-1 font-bold text-white">{drillName(session)}</p>
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
