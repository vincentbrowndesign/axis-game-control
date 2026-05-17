import Link from "next/link"
import ModeNav from "@/components/ModeNav"
import { buildBehaviorMemory } from "@/lib/axis-ai/buildBehaviorMemory"
import { createClient } from "@/lib/supabase/server"
import {
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
    <ModeNav active="team" />
  )
}

function behaviorLine(session: ReplaySessionView) {
  return (
    session.coachNote ||
    session.behaviorSentence ||
    session.coachCorrection ||
    session.coachFlaw ||
    "Add a sentence."
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
      <main className="min-h-screen bg-[#090806] px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
            Team
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to review the team.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            See players, clips, and the sentences they need to repeat.
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
  const watchAgain = sessions.filter((session) =>
    isRepeated(session, repeats, tags)
  )
  const behaviorMemory = buildBehaviorMemory({ sessions })
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

  return (
    <main className="min-h-screen bg-[#0b0a08] px-5 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Team
            </h1>
          </div>
          <PrimaryNav />
        </header>

        <section className="grid gap-10 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-10">
            <section>
              <div className="grid gap-5 md:grid-cols-2">
                {playersForReview.map((player) => (
                  <Link
                    key={player.name}
                    href={`/sessions?player=${encodeURIComponent(player.name)}`}
                    className="py-2 transition hover:text-white"
                  >
                    <p className="text-2xl font-black tracking-[-0.03em] text-white">
                      {player.name}
                    </p>
                    <p className="mt-2 text-base leading-7 text-white/60">
                      {player.reviewSession
                        ? behaviorLine(player.reviewSession)
                        : "Check recent practice work"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/35">
                      {player.reviewSession ? (
                        <span>watch again</span>
                      ) : null}
                      <span>{player.recentSessions} recent</span>
                    </div>
                  </Link>
                ))}
                {players.length === 0 && (
                  <p className="text-sm text-white/45">No players yet.</p>
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-black tracking-[-0.03em] text-white/90">
                  Recent clips
                </h2>
                <Link href="/sessions" className="text-xs font-bold text-white/45 hover:text-white">
                  Watch again
                </Link>
              </div>
              <div className="mt-4 grid gap-3">
                {sessions.slice(0, 6).map((session) => (
                  <Link
                    key={session.id}
                    href={`/replay/${session.id}`}
                    className="grid gap-2 py-3 transition hover:text-white sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-bold text-white">{behaviorLine(session)}</p>
                      <p className="mt-1 text-sm text-white/40">
                        {playerName(session)}
                        {isRepeated(session, repeats, tags) ? " / watch again" : ""}
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
            <section className="pb-4">
              <h2 className="text-xl font-black tracking-[-0.03em] text-white/90">
                Common phrases
              </h2>
              <div className="mt-3 grid gap-3">
                {behaviorMemory.clusters.slice(0, 5).map((cluster) => (
                  <Link
                    key={cluster.id}
                    href={`/sessions?q=${encodeURIComponent(cluster.label)}`}
                    className="py-2 transition hover:text-white"
                  >
                    <p className="font-bold text-white">{cluster.label}</p>
                    <p className="mt-1 text-sm text-white/40">
                      {cluster.count} clips or notes
                    </p>
                  </Link>
                ))}
                {behaviorMemory.clusters.length === 0 ? (
                  <p className="text-sm text-white/45">No repeated phrases yet.</p>
                ) : null}
              </div>
            </section>

            <section className="pb-4">
              <h2 className="text-xl font-black tracking-[-0.03em] text-white/90">
                Notes
              </h2>
              <div className="mt-3 grid gap-3">
                {coachNotes.map((session) => (
                  <Link
                    key={session.id}
                    href={`/replay/${session.id}`}
                    className="py-3 transition hover:text-white"
                  >
                    <p className="text-sm text-white/75">{session.coachNote}</p>
                    <p className="mt-2 text-xs text-white/35">
                      {playerName(session)}
                    </p>
                  </Link>
                ))}
                {coachNotes.length === 0 && (
                  <p className="text-sm text-white/45">No coach notes yet.</p>
                )}
              </div>
            </section>

            <section className="pb-4">
              <h2 className="text-xl font-black tracking-[-0.03em] text-white/90">
                Watch again
              </h2>
              <div className="mt-3 grid gap-3">
                {watchAgain.slice(0, 6).map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions?view=repeated&player=${encodeURIComponent(playerName(session))}`}
                    className="py-3 transition hover:text-white"
                  >
                    <p className="font-bold text-white">{behaviorLine(session)}</p>
                    <p className="mt-1 text-sm text-white/45">
                      {playerName(session)}
                    </p>
                  </Link>
                ))}
                {watchAgain.length === 0 && (
                  <p className="text-sm text-white/45">No clips yet.</p>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
