import Link from "next/link"
import ModeNav from "@/components/ModeNav"
import { clusterCoachingLanguage } from "@/lib/axis-ai/clusterCoachingLanguage"
import {
  normalizeSessions,
  playerName,
} from "@/lib/archive/sessionRollup"
import { createClient } from "@/lib/supabase/server"
import type { AxisReplaySession, AxisVoiceNote } from "@/types/memory"

type Props = {
  searchParams?: Promise<{
    player?: string
  }>
}

type PlayerMemory = {
  name: string
  phrases: AxisVoiceNote[]
}

const fallbackPlayers = ["AJ", "Liam", "Kendal"]
const waveformBars = [38, 72, 46, 84, 54, 66, 92, 42, 76, 58, 88, 50]

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function mentionsPlayer(phrase: string, player: string) {
  const lowerPhrase = phrase.toLowerCase()
  const lowerPlayer = player.toLowerCase()

  return (
    lowerPhrase.startsWith(`${lowerPlayer} `) ||
    lowerPhrase.includes(` ${lowerPlayer} `) ||
    lowerPhrase.endsWith(` ${lowerPlayer}`)
  )
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Today"

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })
}

function formatTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export default async function PlayersPage({ searchParams }: Props) {
  const params = await searchParams
  const selectedPlayer = textParam(params?.player).trim()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0b0a08] px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to see player memory.
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

  const [{ data: voiceNotes }, { data: sessionsData }] = await Promise.all([
    supabase
      .from("axis_voice_notes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(120)
      .returns<AxisVoiceNote[]>(),
    supabase
      .from("axis_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80)
      .returns<AxisReplaySession[]>(),
  ])

  const phrases = voiceNotes || []
  const sessions = normalizeSessions(sessionsData || [])
  const players = [
    ...new Set([...sessions.map(playerName), ...fallbackPlayers].filter(Boolean)),
  ]
  const playerMemories: PlayerMemory[] = players
    .map((name) => ({
      name,
      phrases: phrases.filter((note) => mentionsPlayer(note.phrase, name)),
    }))
    .filter((player) => player.phrases.length > 0 || !selectedPlayer)
    .sort((a, b) => b.phrases.length - a.phrases.length)
  const visiblePlayers = selectedPlayer
    ? playerMemories.filter(
        (player) => player.name.toLowerCase() === selectedPlayer.toLowerCase()
      )
    : playerMemories

  return (
    <main className="min-h-screen bg-[#0c0b09] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <ModeNav active="players" />
        </header>

        <section className="mb-12">
          <p className="text-sm font-bold text-white/42">Players</p>
          <h1 className="mt-2 text-5xl font-black tracking-[-0.05em] text-white sm:text-7xl">
            Player replay.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/48">
            Each player gets the moments, captions, and phrases connected to their name.
          </p>
        </section>

        <section className="grid gap-10">
          {visiblePlayers.map((player) => {
            const clusters = clusterCoachingLanguage(
              player.phrases.map((note) => ({
                id: note.id,
                phrase: note.phrase,
                createdAt: new Date(note.created_at).getTime(),
              }))
            )
            const latest = player.phrases[0]

            return (
              <article
                key={player.name}
                className="grid gap-6 bg-white/[0.035] p-5 lg:grid-cols-[260px_1fr]"
              >
                <div>
                  <Link
                    href={`/players?player=${encodeURIComponent(player.name)}`}
                    className="text-4xl font-black tracking-[-0.05em] text-white transition hover:text-amber-100"
                  >
                    {player.name}
                  </Link>
                  <p className="mt-3 text-sm text-white/42">
                    {player.phrases.length
                      ? `${player.phrases.length} replay moments`
                      : "No mentions yet"}
                  </p>
                </div>

                <div className="grid gap-5">
                  {latest ? (
                    <div>
                      <p className="text-2xl font-black leading-tight tracking-[-0.04em] text-white">
                        {latest.phrase.toUpperCase()}
                      </p>
                      <p className="mt-2 text-sm text-white/35">
                        {timeLabel(latest.created_at)} /{" "}
                        {formatTimestamp(Number(latest.occurred_at_seconds || 0))}
                      </p>
                    </div>
                  ) : (
                    <p className="text-2xl font-black tracking-[-0.04em] text-white">
                      Say {player.name} during practice to start a memory.
                    </p>
                  )}

                  {clusters.length ? (
                    <div className="flex flex-wrap gap-2">
                      {clusters.slice(0, 5).map((cluster) => (
                        <span
                          key={cluster.id}
                          className="bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/58"
                        >
                          {cluster.label}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex h-12 items-end gap-1">
                    {waveformBars.map((height, index) => (
                      <span
                        key={`${player.name}-${height}-${index}`}
                        className="w-full rounded-full bg-white/14"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>

                  {player.phrases.length > 1 ? (
                    <div className="grid gap-3">
                      {player.phrases.slice(1, 4).map((note) => (
                        <p key={note.id} className="text-sm leading-6 text-white/48">
                          {formatTimestamp(Number(note.occurred_at_seconds || 0))} /{" "}
                          {note.phrase}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}

          {visiblePlayers.length === 0 ? (
            <section className="py-20">
              <p className="max-w-xl text-3xl font-black tracking-[-0.04em] text-white">
                No player mentions yet. Start a session and say the player name with the correction.
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
