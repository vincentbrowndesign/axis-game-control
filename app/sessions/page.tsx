import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { buildMemoryState } from "@/lib/memoryInference"
import {
  mapReplaySession,
  type AxisReplaySession,
} from "@/types/memory"

function formatDuration(seconds?: number) {
  if (!seconds) return "0s"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  if (mins <= 0) return `${secs}s`

  return `${mins}m ${secs}s`
}

function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)

  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`

  const hours = Math.floor(mins / 60)

  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}

function formatMemoryCount(count: number) {
  return count.toString().padStart(2, "0")
}

function memoryKey(session: {
  player: string
}) {
  return session.player && session.player !== "Unassigned"
    ? session.player
    : "Unassigned"
}

function previousForSession(
  session: ReturnType<typeof mapReplaySession>,
  sessions: ReturnType<typeof mapReplaySession>[]
) {
  return sessions.filter(
    (item) =>
      item.id !== session.id &&
      item.createdAt < session.createdAt
  )
}

export default async function SessionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-black px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-end">
          <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
            Axis Replay Archive
          </p>
          <h1 className="mt-5 text-[clamp(4rem,15vw,10rem)] font-black leading-[0.82] tracking-[-0.07em]">
            LOCKED
            <br />
            MEMORY
          </h1>
          <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/45">
            Authenticate to open your persistent replay archive.
          </p>
          <Link
            href="/auth"
            className="mt-10 w-fit bg-white px-8 py-5 text-sm font-black uppercase tracking-[0.24em] text-black"
          >
            Enter Axis
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

  const sessions = await Promise.all(
    (data || []).map(async (session) => {
      if (session.file_path) {
        const signed = await supabaseAdmin.storage
          .from("axis-replays")
          .createSignedUrl(session.file_path, 60 * 60 * 24 * 7)

        session.video_url =
          signed.data?.signedUrl || session.video_url
      }

      return mapReplaySession(session)
    })
  )

  const memoryCounts = sessions.reduce<Record<string, number>>(
    (counts, session) => {
      const key = memoryKey(session)

      counts[key] = (counts[key] || 0) + 1

      return counts
    },
    {}
  )

  const memoryStates = sessions.reduce<
    Record<string, ReturnType<typeof buildMemoryState>>
  >((states, session) => {
    states[session.id] = buildMemoryState({
      session,
      previousSessions: previousForSession(session, sessions),
      player: session.player,
    })

    return states
  }, {})

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-6 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
              Axis Replay Archive
            </p>
            <h1 className="mt-4 text-[clamp(4rem,14vw,9rem)] font-black leading-[0.84] tracking-[-0.07em]">
              MEMORY
              <br />
              LIBRARY
            </h1>
          </div>

          <Link
            href="/"
            className="w-fit border border-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white/55 transition hover:text-white"
          >
            Add Memory
          </Link>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <div className="border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
              Memory Count
            </p>
            <p className="mt-3 text-5xl font-black text-lime-300">
              {formatMemoryCount(sessions.length)}
            </p>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
              Last Signal
            </p>
            <p className="mt-4 text-xl font-black uppercase tracking-[-0.02em] text-white">
              {sessions.length ? relativeTime(sessions[0].createdAt) : "None"}
            </p>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
              Archive Status
            </p>
            <p className="mt-4 text-xl font-black uppercase tracking-[-0.02em] text-white">
              {sessions.length ? "Active" : "Waiting"}
            </p>
          </div>
        </div>

        <p className="mb-6 text-sm uppercase tracking-[0.35em] text-white/35">
          {sessions.length
            ? "Memory online."
            : "Archive ready."}
        </p>

        <div className="grid gap-5">
          {sessions.map((session) => {
            const memoryState = memoryStates[session.id]
            const count =
              memoryState?.memoryCount ||
              memoryCounts[memoryKey(session)] ||
              1

            return (
            <Link
              key={session.id}
              href={`/replay/${session.id}`}
              className="group overflow-hidden border border-white/10 bg-white/[0.03] transition hover:border-white/25"
            >
              <div className="grid gap-0 lg:grid-cols-[minmax(280px,0.9fr)_1.1fr]">
                <div className="relative aspect-video overflow-hidden bg-black">
                  {session.videoUrl ? (
                    <video
                      src={session.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover opacity-60 transition duration-500 group-hover:opacity-80"
                    />
                  ) : (
                    <div className="h-full w-full bg-white/[0.04]" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                </div>

                <div className="flex min-h-full flex-col justify-between p-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-lime-300">
                      {session.environment}
                    </span>
                    <span className="border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-cyan-300">
                      Memory {formatMemoryCount(count)}
                    </span>
                    <span className="border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-white/40">
                      {session.status === "stored"
                        ? memoryState?.status || "Memory Stored"
                        : session.status || "Session Added"}
                    </span>
                  </div>

                  <div className="mt-10">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white/30">
                      Player Context
                    </p>
                    <h2 className="mt-3 text-[clamp(2.5rem,8vw,5rem)] font-black leading-[0.9] tracking-[-0.05em]">
                      {session.player || "Unassigned"}
                    </h2>
                    <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/40">
                      <span>{relativeTime(session.createdAt)}</span>
                      <span>/</span>
                      <span>
                        {formatDuration(session.duration || 0)}
                      </span>
                      <span>/</span>
                      <span>
                        {memoryState?.contextLine ||
                          "Session added to archive."}
                      </span>
                    </div>

                    <div className="mt-8 grid gap-2 sm:grid-cols-3">
                      <div className="border border-white/10 bg-black/30 p-3">
                        <p className="text-[9px] uppercase tracking-[0.3em] text-white/25">
                          Player
                        </p>
                        <p className="mt-2 text-sm text-white/70">
                          {session.player || "Unassigned"}
                        </p>
                      </div>
                      <div className="border border-white/10 bg-black/30 p-3">
                        <p className="text-[9px] uppercase tracking-[0.3em] text-white/25">
                          Session
                        </p>
                        <p className="mt-2 text-sm text-white/70">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="border border-white/10 bg-black/30 p-3">
                        <p className="text-[9px] uppercase tracking-[0.3em] text-white/25">
                          Replay Status
                        </p>
                        <p className="mt-2 text-sm text-lime-300">
                          {memoryState?.archiveStatus ||
                            "Archive Active"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )})}

          {sessions.length === 0 && (
            <div className="border border-white/10 bg-white/[0.03] p-12">
              <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
                Archive Empty
              </p>
              <h2 className="mt-5 text-5xl font-black leading-none tracking-[-0.05em] text-white/75">
                Memory waiting.
              </h2>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
