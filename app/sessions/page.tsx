import Link from "next/link"
import ModeNav from "@/components/ModeNav"
import { clusterCoachingLanguage } from "@/lib/axis-ai/clusterCoachingLanguage"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { AxisVoiceNote } from "@/types/memory"

type VoiceNoteWithAudio = AxisVoiceNote & {
  audioUrl?: string | null
}

const waveformBars = [
  34, 62, 44, 76, 52, 88, 38, 68, 96, 48, 72, 42, 84, 58, 36, 74,
  54, 92, 46, 66, 40, 78, 50, 86,
]

function sessionDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recent"

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recent"

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function formatVideoWindow(totalSeconds: number) {
  const start = Math.max(0, totalSeconds - 5)
  const end = totalSeconds + 5

  return `${formatTimestamp(start)}-${formatTimestamp(end)}`
}

function metadataText(
  metadata: Record<string, unknown> | null,
  key: string
) {
  const value = metadata?.[key]

  return typeof value === "string" && value.trim() ? value : ""
}

async function signedAudioUrl(path: string) {
  if (!path) return null

  const signed = await supabaseAdmin.storage
    .from("axis-replays")
    .createSignedUrl(path, 60 * 60 * 24)

  return signed.data?.signedUrl || null
}

function groupBySession(notes: VoiceNoteWithAudio[]) {
  const grouped = new Map<string, VoiceNoteWithAudio[]>()

  for (const note of notes) {
    const key = note.session_id || sessionDay(note.created_at)
    grouped.set(key, [...(grouped.get(key) || []), note])
  }

  return [...grouped.entries()].map(([id, phrases], index) => ({
    id,
    title: index === 0 ? "Latest session" : `${sessionDay(phrases[0]?.created_at)} session`,
    time: sessionDay(phrases[0]?.created_at || ""),
    phrases,
    clusters: clusterCoachingLanguage(
      phrases.map((note) => ({
        id: note.id,
        phrase: note.phrase,
        createdAt: new Date(note.created_at).getTime(),
      }))
    ),
  }))
}

export default async function SessionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0b0a08] px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to replay sessions.
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
    .from("axis_voice_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(160)
    .returns<AxisVoiceNote[]>()

  const notesWithAudio = await Promise.all(
    (data || []).map(async (note): Promise<VoiceNoteWithAudio> => ({
      ...note,
      audioUrl: await signedAudioUrl(metadataText(note.metadata, "audioPath")),
    }))
  )
  const sessions = groupBySession(notesWithAudio)

  return (
    <main className="min-h-screen bg-[#090806] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <ModeNav active="sessions" />
        </header>

        <section className="mb-12">
          <p className="text-sm font-bold text-white/42">Sessions</p>
          <h1 className="mt-2 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-7xl">
            Playback library.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/48">
            Each session becomes captions, landmarks, and phrases players can replay.
          </p>
        </section>

        <section className="grid gap-8">
          {sessions.map((session) => (
            <article
              key={session.id}
              className="grid gap-6 bg-white/[0.035] p-5 lg:grid-cols-[1fr_320px]"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-3xl font-black tracking-[-0.04em] text-white">
                      {session.title}
                    </p>
                    <p className="mt-2 text-sm text-white/38">
                      {session.time} / {session.phrases.length} landmarks / voice synced
                    </p>
                  </div>
                  <Link
                    href="/#record"
                    className="text-sm font-black text-amber-100/80 transition hover:text-amber-100"
                  >
                    Play
                  </Link>
                </div>

                <div className="mt-6 flex h-20 items-end gap-1">
                  {waveformBars.map((height, index) => (
                    <span
                      key={`${session.id}-${height}-${index}`}
                      className="w-full rounded-full bg-white/14"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>

                <p className="mt-6 max-w-3xl text-4xl font-black leading-[0.96] tracking-[-0.05em] text-white sm:text-5xl">
                  {(session.phrases[0]?.phrase || "Session ready").toUpperCase()}
                </p>
              </div>

              <aside>
                <p className="text-sm font-bold text-white/42">Landmarks</p>
                <div className="mt-4 grid gap-3">
                  {session.phrases.slice(0, 6).map((note) => (
                    <div key={note.id} className="border-b border-white/8 pb-3">
                      <p className="text-sm font-black text-white">
                        {note.phrase.toUpperCase()}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        {timeLabel(note.created_at)} /{" "}
                        {formatTimestamp(Number(note.occurred_at_seconds || 0))} /{" "}
                        {formatVideoWindow(Number(note.occurred_at_seconds || 0))}
                      </p>
                      {note.audioUrl ? (
                        <audio
                          src={note.audioUrl}
                          controls
                          className="mt-3 w-full"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>

                {session.clusters.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {session.clusters.slice(0, 4).map((cluster) => (
                      <span
                        key={cluster.id}
                        className="bg-white/[0.05] px-3 py-2 text-xs font-bold text-white/55"
                      >
                        {cluster.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </aside>
            </article>
          ))}

          {sessions.length === 0 ? (
            <section className="py-24">
              <p className="max-w-xl text-3xl font-black tracking-[-0.04em] text-white">
                Record a session and its playback will appear here.
              </p>
              <Link
                href="/#record"
                className="mt-6 inline-block bg-stone-100 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
              >
                Record
              </Link>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  )
}
