import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import type {
  TemporalEventRecord,
  TemporalSessionRecord,
} from "@/lib/temporalEventGraph"
import {
  buildReplayRetrieval,
  replayRetrievalPresets,
  type ReplayRetrievalClip,
} from "@/lib/retrieval/liveReplayRetrieval"

type RetrievePageProps = {
  searchParams: Promise<{
    q?: string
    preset?: string
  }>
}

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function clipHref(clip: ReplayRetrievalClip) {
  const params = new URLSearchParams({
    jump: clip.eventId,
  })

  return `/session/${clip.sessionId}?${params.toString()}`
}

function RetrievalClipCard({ clip }: { clip: ReplayRetrievalClip }) {
  return (
    <Link
      href={clipHref(clip)}
      className="axis-familiar-bar axis-optical-transition block border p-4 transition hover:bg-white/[0.055]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="axis-mono truncate text-[10px] font-black uppercase tracking-[0.18em] text-white/52">
            {clip.team} / {clip.eventType}
          </p>
          <h2 className="mt-2 truncate text-lg font-black uppercase tracking-normal text-white/88">
            {clip.label}
          </h2>
        </div>
        <div className="axis-broadcast-chip axis-mono shrink-0 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]">
          {clip.score}
        </div>
      </div>
      <div className="axis-mono mt-5 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/42">
        <span>{formatClock(clip.sessionTime)}</span>
        <span>
          {formatClock(clip.clipStart)}-{formatClock(clip.clipEnd)}
        </span>
      </div>
    </Link>
  )
}

export default async function RetrievePage({ searchParams }: RetrievePageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="axis-display axis-sync-room grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="axis-mono axis-sync-muted text-[11px] font-black uppercase tracking-[0.28em]">
            SIGN IN TO FIND REPLAYS
          </p>
          <Link
            href="/auth"
            className="axis-mono axis-familiar-primary mt-7 inline-flex px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("operator_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(18)
    .returns<TemporalSessionRecord[]>()
  const sessionIds = (sessions || []).map((session) => session.id)
  const { data: events } = sessionIds.length
    ? await supabase
        .from("events")
        .select("*")
        .in("session_id", sessionIds)
        .order("session_time", {
          ascending: true,
        })
        .returns<TemporalEventRecord[]>()
    : {
        data: [] as TemporalEventRecord[],
      }
  const retrieval = buildReplayRetrieval({
    sessions: sessions || [],
    events: events || [],
    preset: params.preset,
    query: params.q,
  })
  const q = params.q || ""

  return (
    <main className="axis-display axis-sync-room axis-familiar-room min-h-dvh px-4 py-6 text-white sm:px-8">
      <section className="mx-auto grid max-w-6xl gap-8">
        <header className="grid gap-5">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/live"
              className="axis-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/46 transition hover:text-white/78"
            >
              Live
            </Link>
            <Link
              href="/training-set"
              className="axis-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/46 transition hover:text-white/78"
            >
              Saved clips
            </Link>
          </div>
          <div>
            <p className="axis-mono text-[10px] font-black uppercase tracking-[0.24em] text-white/42">
              Replay recall
            </p>
            <h1 className="mt-3 max-w-3xl text-5xl font-black uppercase leading-[0.92] tracking-normal text-white sm:text-7xl">
              Find the play.
            </h1>
          </div>
          <form className="axis-familiar-bar grid gap-3 border p-3 sm:grid-cols-[1fr_auto]">
            <input
              name="q"
              defaultValue={q}
              placeholder="Player, score, turnover, rebound"
              className="min-h-12 bg-transparent px-3 text-sm font-bold uppercase tracking-[0.08em] text-white/82 outline-none placeholder:text-white/30"
            />
            <button
              type="submit"
              className="axis-familiar-primary px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em]"
            >
              Find clips
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {replayRetrievalPresets.map((preset) => {
              const active = retrieval.preset === preset.key
              const href = q
                ? `/retrieve?preset=${preset.key}&q=${encodeURIComponent(q)}`
                : `/retrieve?preset=${preset.key}`

              return (
                <Link
                  key={preset.key}
                  href={href}
                  className={`axis-mono px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                    active ? "axis-familiar-primary" : "axis-familiar-control"
                  }`}
                >
                  {preset.label}
                </Link>
              )
            })}
          </div>
        </header>

        {retrieval.clusters.length ? (
          <section className="grid gap-3 md:grid-cols-2">
            {retrieval.clusters.slice(0, 4).map((cluster) => (
              <Link
                key={cluster.id}
                href={`/retrieve?preset=${cluster.id === "scoring" ? "makes" : cluster.id}`}
                className="axis-familiar-bar axis-optical-transition border p-4 transition hover:bg-white/[0.05]"
              >
                <p className="axis-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/46">
                  {cluster.subtitle}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <h2 className="text-2xl font-black uppercase tracking-normal text-white/86">
                    {cluster.title}
                  </h2>
                  <span className="axis-broadcast-chip axis-mono px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]">
                    {cluster.clips.length}
                  </span>
                </div>
              </Link>
            ))}
          </section>
        ) : null}

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="axis-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/42">
              {retrieval.clips.length} clips ready
            </p>
            <p className="axis-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Opens exact replay
            </p>
          </div>
          {retrieval.clips.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {retrieval.clips.map((clip) => (
                <RetrievalClipCard key={clip.id} clip={clip} />
              ))}
            </div>
          ) : (
            <div className="axis-familiar-bar border p-6">
              <p className="text-2xl font-black uppercase tracking-normal text-white/80">
                No tagged clips yet.
              </p>
              <p className="mt-3 max-w-xl text-sm font-bold text-white/42">
                Start a live recording, tag a few plays, then come back here for instant recall.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
