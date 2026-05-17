import Link from "next/link"
import ModeNav from "@/components/ModeNav"
import { buildBehaviorMemory } from "@/lib/axis-ai/buildBehaviorMemory"
import {
  isRepeated,
  isRecent,
  normalizeSessions,
  playerName,
  relativeTime,
  repeatCounts,
  tagCounts,
} from "@/lib/archive/sessionRollup"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AxisReplaySession, ReplaySessionView } from "@/types/memory"

type WatchView = "all" | "recent" | "again"

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function viewParam(value: string): WatchView {
  if (value === "recent" || value === "again") return value
  if (value === "repeated") return "again"
  return "all"
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

function sessionText(session: ReplaySessionView) {
  return [
    behaviorLine(session),
    playerName(session),
    session.title,
    session.mission,
    ...session.tags,
  ]
    .join(" ")
    .toLowerCase()
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

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = textParam(params.q).trim()
  const view = viewParam(textParam(params.view))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0b0a08] px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to watch clips.
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
  const behaviorMemory = buildBehaviorMemory({ sessions })

  const visibleSessions = sessions.filter((session) => {
    const matchesQuery =
      !query || sessionText(session).includes(query.toLowerCase())
    const matchesView =
      view === "all" ||
      (view === "recent" && isRecent(session)) ||
      (view === "again" && isRepeated(session, repeats, tags))

    return matchesQuery && matchesView
  })

  const heroClip = visibleSessions[0]

  return (
    <main className="min-h-screen bg-[#0c0b09] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <ModeNav active="watch" />
        </header>

        <section className="mb-10 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-5xl font-black tracking-[-0.05em] text-white sm:text-7xl">
              Watch
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-white/48">
              Clips and the sentences players need to hear again.
            </p>
          </div>
          <Link
            href="/"
            className="w-fit bg-stone-100 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
          >
            Record
          </Link>
        </section>

        <section className="mb-8 grid gap-3 sm:grid-cols-[1fr_auto]">
          <form action="/sessions" className="contents">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search player or phrase"
              className="bg-black/25 px-4 py-4 text-base text-white outline-none placeholder:text-white/25"
            />
            <button className="bg-white/[0.07] px-5 py-4 text-sm font-bold text-white/70 transition hover:bg-white hover:text-black">
              Find
            </button>
          </form>
        </section>

        <div className="mb-10 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-white/42">
          <Link
            href="/sessions"
            className={view === "all" ? "text-white" : "transition hover:text-white"}
          >
            All clips
          </Link>
          <Link
            href="/sessions?view=recent"
            className={view === "recent" ? "text-white" : "transition hover:text-white"}
          >
            Recent
          </Link>
          <Link
            href="/sessions?view=again"
            className={view === "again" ? "text-white" : "transition hover:text-white"}
          >
            Watch again
          </Link>
        </div>

        {heroClip ? (
          <section className="mb-14">
            <Link href={`/replay/${heroClip.id}`} className="group block">
              <div className="aspect-[4/5] overflow-hidden bg-black/75 shadow-[0_34px_90px_rgba(0,0,0,0.38)] sm:aspect-video">
                <ClipPreview session={heroClip} />
              </div>
              <div className="mt-5 max-w-3xl">
                <p className="text-sm font-bold text-white/45">
                  {playerName(heroClip)} / {relativeTime(heroClip.createdAt)}
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight tracking-[-0.04em] text-white sm:text-5xl">
                  {behaviorLine(heroClip)}
                </h2>
              </div>
            </Link>
          </section>
        ) : null}

        <section className="grid gap-10 md:grid-cols-2">
          {visibleSessions.slice(heroClip ? 1 : 0).map((session) => (
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
                  className="mt-1 block text-xl font-black leading-tight tracking-[-0.03em] text-white transition hover:text-amber-100"
                >
                  {behaviorLine(session)}
                </Link>
              </div>
            </article>
          ))}
        </section>

        {visibleSessions.length === 0 ? (
          <section className="py-24">
            <p className="max-w-xl text-3xl font-black tracking-[-0.04em] text-white">
              No clips yet. Record a moment, say the sentence, and it will show up here.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block bg-stone-100 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
            >
              Record
            </Link>
          </section>
        ) : null}

        {behaviorMemory.clusters.length ? (
          <section className="mt-16 border-t border-white/8 pt-8">
            <h2 className="text-sm font-bold text-white/40">Repeated phrases</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {behaviorMemory.clusters.slice(0, 6).map((cluster) => (
                <Link
                  key={cluster.id}
                  href={`/sessions?q=${encodeURIComponent(cluster.label)}`}
                  className="bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/58 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {cluster.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
