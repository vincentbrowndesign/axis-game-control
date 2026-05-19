import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import type {
  TemporalEventRecord,
  TemporalSessionRecord,
  TemporalSnapshotRecord,
} from "@/lib/temporalEventGraph"

type SessionPageProps = {
  params: Promise<{
    id: string
  }>
}

function formatClock(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="grid min-h-dvh place-items-center bg-black px-6 text-center text-zinc-100">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
            SESSION ACCESS REQUIRED
          </p>
          <Link
            href="/auth"
            className="mt-7 inline-flex border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .eq("operator_id", user.id)
    .maybeSingle<TemporalSessionRecord>()

  if (!session) {
    return (
      <main className="grid min-h-dvh place-items-center bg-black px-6 text-center text-zinc-100">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
            SESSION NOT FOUND
          </p>
          <Link
            href="/live"
            className="mt-7 inline-flex border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
          >
            Return live
          </Link>
        </div>
      </main>
    )
  }

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("session_id", id)
    .order("session_time", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    })
    .returns<TemporalEventRecord[]>()

  const { data: snapshots } = await supabase
    .from("snapshots")
    .select("*")
    .eq("session_id", id)
    .order("session_time", {
      ascending: true,
    })
    .returns<TemporalSnapshotRecord[]>()

  return (
    <main className="min-h-dvh bg-black text-zinc-100">
      <section className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-4 sm:px-6">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/10 py-3">
          <Link
            href="/live"
            className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-100"
          >
            AXIS
          </Link>
          <div className="h-px bg-white/14" />
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-400">
            {session.status}
          </p>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-5 py-6">
          {session.playback_url ? (
            <div className="overflow-hidden border border-white/10 bg-zinc-950">
              <video
                src={session.playback_url}
                controls
                playsInline
                className="aspect-video w-full bg-black object-contain"
              />
            </div>
          ) : (
            <div className="grid aspect-video place-items-center border border-white/10 bg-zinc-950 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Playback not ready
              </p>
            </div>
          )}

          <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Session runtime
              </p>
              <p className="mt-2 font-mono text-4xl font-black leading-none text-zinc-100">
                {formatClock(session.duration_seconds)}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                Created
              </p>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-zinc-200">
                {formatDate(session.created_at)}
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Events
              </p>
              <p className="font-mono text-xs font-bold text-zinc-500">
                {(events || []).length} events · {(snapshots || []).length} snapshots
              </p>
            </div>
            <div className="mt-4 grid gap-2">
              {(events || []).slice(0, 12).map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[5rem_1fr] items-center border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <p className="font-mono text-xs font-black text-zinc-500">
                    {formatClock(event.session_time)}
                  </p>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-200">
                    {event.type}
                  </p>
                </div>
              ))}
              {!events?.length ? (
                <p className="border border-white/10 bg-white/[0.03] px-3 py-3 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                  No events recorded.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
