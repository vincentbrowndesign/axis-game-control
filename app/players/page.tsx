import Link from "next/link"
import ModeNav from "@/components/ModeNav"
import { buildBehaviorMemory } from "@/lib/axis-ai/buildBehaviorMemory"
import {
  isRepeated,
  normalizeSessions,
  playerName,
  relativeTime,
  repeatCounts,
  tagCounts,
} from "@/lib/archive/sessionRollup"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisReplaySession, ReplaySessionView } from "@/types/memory"

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

export default async function PlayersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0b0a08] px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to watch player clips.
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
  const grouped = new Map<string, ReplaySessionView[]>()

  for (const session of sessions) {
    const name = playerName(session)
    grouped.set(name, [...(grouped.get(name) || []), session])
  }

  const players = [...grouped.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )

  return (
    <main className="min-h-screen bg-[#0c0b09] px-5 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            Players
          </h1>
          <ModeNav active="players" />
        </header>

        <section className="grid gap-10">
          {players.map(([name, clips]) => {
            const latest = clips[0]
            const memory = buildBehaviorMemory({ sessions: clips })
            const watchAgain = clips.filter((clip) =>
              isRepeated(clip, repeats, tags)
            )

            return (
              <article key={name} className="grid gap-5 md:grid-cols-[1fr_1fr]">
                <Link
                  href={latest ? `/replay/${latest.id}` : `/sessions?player=${name}`}
                  className="aspect-[4/5] overflow-hidden bg-black/70 sm:aspect-video"
                >
                  {latest && isClipProcessing(latest.status) ? (
                    <div className="grid h-full place-items-center text-sm font-bold text-white/35">
                      Clip processing...
                    </div>
                  ) : latest && isClipError(latest.status) ? (
                    <div className="grid h-full place-items-center text-sm font-bold text-white/35">
                      Clip unavailable
                    </div>
                  ) : latest?.videoUrl ? (
                    <video
                      src={latest.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover opacity-85"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-sm font-bold text-white/30">
                      No clips yet
                    </div>
                  )}
                </Link>

                <div className="grid content-start gap-3">
                  <Link
                    href={`/sessions?player=${encodeURIComponent(name)}`}
                    className="text-3xl font-black tracking-[-0.04em] transition hover:text-amber-100"
                  >
                    {name}
                  </Link>
                  {latest ? (
                    <p className="text-lg leading-7 text-white/75">
                      {behaviorLine(latest)}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-sm text-white/40">
                    <span>{clips.length} clips</span>
                    {watchAgain.length ? (
                      <span>{watchAgain.length} to watch again</span>
                    ) : null}
                    {latest ? <span>{relativeTime(latest.createdAt)}</span> : null}
                  </div>
                  {memory.clusters.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {memory.clusters.slice(0, 3).map((cluster) => (
                        <Link
                          key={cluster.id}
                          href={`/sessions?player=${encodeURIComponent(name)}&q=${encodeURIComponent(cluster.label)}`}
                          className="bg-white/[0.04] px-3 py-2 text-sm font-bold text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          {cluster.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}

          {players.length === 0 ? (
            <div className="py-20">
              <p className="text-3xl font-black tracking-[-0.04em] text-white">
                Record a clip to start a player feed.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block bg-stone-100 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
              >
                Record
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
