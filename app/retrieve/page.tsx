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
import {
  AxisEmptyState,
  AxisHeader,
  AxisLinkButton,
  AxisPage,
} from "@/components/axis/AxisPrimitives"

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

function MomentRow({ clip }: { clip: ReplayRetrievalClip }) {
  return (
    <Link
      href={clipHref(clip)}
      className="group grid gap-3 border-t border-white/[0.08] py-4 transition hover:border-white/[0.18] hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="truncate text-2xl font-black uppercase leading-none tracking-normal text-white/90 sm:text-3xl">
            {clip.label}
          </h2>
          <span className="axis-mono shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-white/38">
            {formatClock(clip.sessionTime)}
          </span>
        </div>
        <div className="axis-mono mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/42">
          <span>{clip.score}</span>
          <span>POS {clip.possession}</span>
          <span>
            {formatClock(clip.clipStart)}-{formatClock(clip.clipEnd)}
          </span>
          {clip.player ? <span>{clip.player}</span> : null}
        </div>
      </div>
      <div className="axis-mono flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/34 transition group-hover:text-white/62">
        <span>{clip.previousEventId ? "Context linked" : "First memory"}</span>
        <span>Open</span>
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
      <AxisPage center max="max-w-xl">
        <div>
          <p className="axis-mono axis-sync-muted text-[11px] font-black uppercase tracking-[0.28em]">
            SIGN IN TO FIND REPLAYS
          </p>
          <AxisLinkButton href="/auth" tone="primary" className="mt-7 inline-flex">
            Sign in
          </AxisLinkButton>
        </div>
      </AxisPage>
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
  const activeContext = q || replayRetrievalPresets.find((preset) => preset.key === retrieval.preset)?.label || "All moments"

  return (
    <AxisPage max="max-w-5xl" className="axis-replay-operating-room px-4 py-6 sm:px-8">
      <div className="grid gap-7 pb-24">
        <header className="grid gap-6 pb-2">
          <AxisHeader title="Live">
            <AxisLinkButton href="/live" tone="ghost" className="px-0 py-0">
              Live
            </AxisLinkButton>
          </AxisHeader>
          <div>
            <p className="axis-mono axis-world-kicker text-[10px] font-black uppercase tracking-[0.24em]">
              Memory retrieval
            </p>
            <h1 className="axis-world-title mt-3 max-w-4xl text-5xl font-black uppercase leading-[0.92] tracking-normal sm:text-7xl">
              Memory timeline.
            </h1>
            <div className="axis-mono mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
              <span>{activeContext}</span>
              <span>{retrieval.clips.length} moments</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-y border-white/[0.08] py-3">
            {replayRetrievalPresets.map((preset) => {
              const active = retrieval.preset === preset.key
              const href = q
                ? `/retrieve?preset=${preset.key}&q=${encodeURIComponent(q)}`
                : `/retrieve?preset=${preset.key}`

              return (
                <Link
                  key={preset.key}
                  href={href}
                  className={`axis-mono text-[10px] font-black uppercase tracking-[0.14em] transition ${
                    active ? "text-white" : "text-white/36 hover:text-white/68"
                  }`}
                >
                  {preset.label}
                </Link>
              )
            })}
          </div>
        </header>

        {retrieval.clusters.length ? (
          <section className="flex flex-wrap gap-x-5 gap-y-2">
            {retrieval.clusters.slice(0, 4).map((cluster) => (
              <Link
                key={cluster.id}
                href={`/retrieve?preset=${cluster.id === "scoring" ? "makes" : cluster.id}`}
                className="axis-mono text-[10px] font-black uppercase tracking-[0.16em] text-white/38 transition hover:text-white/70"
              >
                {cluster.title} / {cluster.clips.length}
              </Link>
            ))}
          </section>
        ) : null}

        <section className="grid gap-1">
          {retrieval.clips.length ? (
            <div>
              {retrieval.clips.map((clip) => (
                <MomentRow key={clip.id} clip={clip} />
              ))}
            </div>
          ) : (
            <AxisEmptyState title="No memory yet." className="border-0 bg-transparent">
              <p>
                Start live, speak the game into the rail, then return here as moments accumulate.
              </p>
            </AxisEmptyState>
          )}
        </section>
      </div>
    </AxisPage>
  )
}
