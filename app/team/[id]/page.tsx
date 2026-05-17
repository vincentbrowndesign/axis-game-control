import Link from "next/link"
import ModeNav from "@/components/ModeNav"
import { buildBehaviorMemory } from "@/lib/axis-ai/buildBehaviorMemory"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
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

function behaviorLine(session: ReplaySessionView) {
  return (
    session.coachNote ||
    session.behaviorSentence ||
    session.coachCorrection ||
    session.coachFlaw ||
    "Watch this again."
  )
}

function isClipProcessing(status?: string) {
  return status === "uploaded" || status === "processing" || status === "created"
}

function isClipError(status?: string) {
  return status === "error"
}

function ClipPreview({ session }: { session: ReplaySessionView }) {
  if (isClipProcessing(session.status)) {
    return (
      <div className="grid h-full place-items-center text-sm font-bold text-white/35">
        Clip processing...
      </div>
    )
  }

  if (isClipError(session.status)) {
    return (
      <div className="grid h-full place-items-center text-sm font-bold text-white/35">
        Clip unavailable
      </div>
    )
  }

  if (session.videoUrl) {
    return (
      <video
        src={session.videoUrl}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.01] group-hover:opacity-100"
      />
    )
  }

  return (
    <div className="grid h-full place-items-center text-sm font-bold text-white/30">
      Clip saved
    </div>
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
      <main className="min-h-screen bg-[#0b0a08] px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to watch team clips.
          </h1>
          <Link
            href="/auth"
            className="mt-8 w-fit bg-stone-100 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
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
  const tags = tagCounts(sessions)
  const repeats = repeatCounts(sessions)
  const players = playerSummaries(sessions)
  const behaviorMemory = buildBehaviorMemory({ sessions })
  const watchAgain = sessions.filter((session) =>
    isRepeated(session, repeats, tags)
  )
  const heroClip = watchAgain[0] || sessions[0]

  return (
    <main className="min-h-screen bg-[#0c0b09] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <ModeNav active="team" />
        </header>

        <section className="mb-10">
          <h1 className="text-5xl font-black tracking-[-0.05em] text-white sm:text-7xl">
            Team
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-white/48">
            Recent clips, common phrases, and players to watch again.
          </p>
        </section>

        {heroClip ? (
          <section className="mb-14 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <Link
              href={`/replay/${heroClip.id}`}
              className="group block aspect-[4/5] overflow-hidden bg-black/75 shadow-[0_34px_90px_rgba(0,0,0,0.38)] sm:aspect-video"
            >
              <ClipPreview session={heroClip} />
            </Link>
            <div>
              <p className="text-sm font-bold text-white/45">
                {playerName(heroClip)} / {relativeTime(heroClip.createdAt)}
              </p>
              <Link
                href={`/replay/${heroClip.id}`}
                className="mt-2 block text-3xl font-black leading-tight tracking-[-0.04em] text-white transition hover:text-amber-100 sm:text-5xl"
              >
                {behaviorLine(heroClip)}
              </Link>
            </div>
          </section>
        ) : null}

        <section className="mb-14 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-white">
                Recent clips
              </h2>
              <Link
                href="/sessions"
                className="text-sm font-bold text-white/40 transition hover:text-white"
              >
                Watch
              </Link>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              {sessions.slice(heroClip ? 1 : 0, heroClip ? 7 : 6).map((session) => (
                <article key={session.id} className="group">
                  <Link
                    href={`/replay/${session.id}`}
                    className="block aspect-[4/5] overflow-hidden bg-black/70 sm:aspect-video"
                  >
                    <ClipPreview session={session} />
                  </Link>
                  <div className="mt-3">
                    <p className="text-sm font-bold text-white/45">
                      {playerName(session)} / {relativeTime(session.createdAt)}
                    </p>
                    <Link
                      href={`/replay/${session.id}`}
                      className="mt-1 block text-lg font-black leading-tight tracking-[-0.03em] text-white transition hover:text-amber-100"
                    >
                      {behaviorLine(session)}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="grid h-fit gap-9">
            <section>
              <h2 className="text-xl font-black tracking-[-0.03em] text-white">
                Common phrases
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {behaviorMemory.clusters.slice(0, 7).map((cluster) => (
                  <Link
                    key={cluster.id}
                    href={`/sessions?q=${encodeURIComponent(cluster.label)}`}
                    className="bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/58 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    {cluster.label}
                  </Link>
                ))}
                {behaviorMemory.clusters.length === 0 ? (
                  <p className="text-sm text-white/42">
                    Phrases will appear after more clips.
                  </p>
                ) : null}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black tracking-[-0.03em] text-white">
                Players
              </h2>
              <div className="mt-4 grid gap-4">
                {players.slice(0, 8).map((player) => (
                  <Link
                    key={player.name}
                    href={`/sessions?player=${encodeURIComponent(player.name)}`}
                    className="transition hover:text-amber-100"
                  >
                    <p className="text-lg font-black text-white">{player.name}</p>
                    <p className="mt-1 text-sm text-white/42">
                      {player.recentSessions} recent clips
                    </p>
                  </Link>
                ))}
                {players.length === 0 ? (
                  <p className="text-sm text-white/42">No players yet.</p>
                ) : null}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black tracking-[-0.03em] text-white">
                Watch again
              </h2>
              <div className="mt-4 grid gap-4">
                {watchAgain.slice(0, 5).map((session) => (
                  <Link
                    key={session.id}
                    href={`/replay/${session.id}`}
                    className="transition hover:text-amber-100"
                  >
                    <p className="text-sm font-bold leading-6 text-white">
                      {behaviorLine(session)}
                    </p>
                    <p className="mt-1 text-xs text-white/35">
                      {playerName(session)}
                    </p>
                  </Link>
                ))}
                {watchAgain.length === 0 ? (
                  <p className="text-sm text-white/42">No clips yet.</p>
                ) : null}
              </div>
            </section>
          </aside>
        </section>

        {sessions.length === 0 ? (
          <section className="py-24">
            <p className="max-w-xl text-3xl font-black tracking-[-0.04em] text-white">
              Record a moment and the team feed starts here.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block bg-stone-100 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
            >
              Record
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  )
}
