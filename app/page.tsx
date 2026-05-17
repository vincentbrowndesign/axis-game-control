import Link from "next/link"
import { redirect } from "next/navigation"
import VoiceMemoryConsole from "@/components/VoiceMemoryConsole"
import { clusterCoachingLanguage } from "@/lib/axis-ai/clusterCoachingLanguage"
import {
  buildMemoryStream,
  type MemoryStreamNote,
} from "@/lib/axis-ai/buildMemoryStream"
import {
  normalizeSessions,
  playerName,
} from "@/lib/archive/sessionRollup"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type {
  AxisProfile,
  AxisReplaySession,
  AxisVoiceNote,
} from "@/types/memory"

type VoicePhrase = {
  id: string
  phrase: string
  createdAt: string
  audioUrl?: string | null
  replayCount?: number
  reason?: string
}

type PlayerMention = {
  name: string
  count: number
  latestPhrase: string
}

type SessionCard = {
  id: string
  title: string
  time: string
  phrases: string[]
  players: string[]
  landmarks: {
    id: string
    phrase: string
    caption: string
    timestamp: string
    videoWindow: string
    player?: string
    replayCount: number
    audioUrl?: string | null
    reason?: string
  }[]
}

const fallbackPlayers = ["AJ", "Liam", "Kendal"]

function buildPlayerMentions(phrases: VoicePhrase[], players: string[]) {
  const names = [...new Set([...players, ...fallbackPlayers])]
    .map((name) => name.trim())
    .filter(Boolean)
  const mentions = new Map<string, PlayerMention>()

  for (const phrase of phrases) {
    const lowerPhrase = phrase.phrase.toLowerCase()

    for (const name of names) {
      const lowerName = name.toLowerCase()
      const matches =
        lowerPhrase.startsWith(`${lowerName} `) ||
        lowerPhrase.includes(` ${lowerName} `) ||
        lowerPhrase.endsWith(` ${lowerName}`)

      if (!matches) continue

      const current = mentions.get(name)
      mentions.set(name, {
        name,
        count: (current?.count || 0) + 1,
        latestPhrase: current?.latestPhrase || phrase.phrase,
      })
    }
  }

  return [...mentions.values()].sort((a, b) => b.count - a.count)
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

function sessionDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recent"

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

function formatVideoWindow(totalSeconds: number) {
  const start = Math.max(0, totalSeconds - 5)
  const end = totalSeconds + 5

  return `${formatTimestamp(start)}-${formatTimestamp(end)}`
}

function buildSessionCards(phrases: VoicePhrase[], mentions: PlayerMention[]) {
  const grouped = new Map<string, VoicePhrase[]>()

  for (const phrase of phrases) {
    const key = sessionDay(phrase.createdAt)
    grouped.set(key, [...(grouped.get(key) || []), phrase])
  }

  return [...grouped.entries()].map(([day, items], index): SessionCard => {
    const players = mentions
      .filter((mention) =>
        items.some((item) =>
          item.phrase.toLowerCase().includes(mention.name.toLowerCase())
        )
      )
      .map((mention) => mention.name)

    return {
      id: `${day}-${index}`,
      title: index === 0 ? "Latest session" : `${day} session`,
      time: day,
      phrases: items.map((item) => item.phrase),
      players: players.slice(0, 4),
      landmarks: items.slice(0, 5).map((item, itemIndex) => {
        const seconds = itemIndex * 18
        const player = mentions.find((mention) =>
          item.phrase.toLowerCase().includes(mention.name.toLowerCase())
        )?.name

        return {
          id: item.id,
          phrase: item.phrase,
          caption: item.phrase.toUpperCase(),
          timestamp: formatTimestamp(seconds),
          videoWindow: formatVideoWindow(seconds),
          player,
          replayCount: item.replayCount || Math.max(1, 6 - itemIndex),
          audioUrl: item.audioUrl || null,
          reason: item.reason,
        }
      }),
    }
  })
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return (
      <main className="min-h-screen bg-[#0c0b09] px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
          <p className="text-sm font-bold text-white/42">Axis</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-[-0.05em] sm:text-7xl">
            Coaching memory, playable.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Record the session and replay the captions that matter.
          </p>
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

  const { data: profile } = await supabase
    .from("axis_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<AxisProfile>()

  if (!profile?.player_name || !profile.role) {
    redirect("/profile?next=/")
  }

  const [{ data: voiceNotes }, { data: sessionsData }] = await Promise.all([
    supabase
      .from("axis_voice_notes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<AxisVoiceNote[]>(),
    supabase
      .from("axis_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<AxisReplaySession[]>(),
  ])

  const notesWithAudio: MemoryStreamNote[] = await Promise.all(
    (voiceNotes || []).map(async (note) => ({
      ...note,
      audioUrl: await signedAudioUrl(metadataText(note.metadata, "audioPath")),
    }))
  )
  const stream = buildMemoryStream({
    notes: notesWithAudio,
    playerNames: [
      ...new Set(
        normalizeSessions(sessionsData || [])
          .map(playerName)
          .filter(Boolean)
      ),
    ],
  })
  const phrases: VoicePhrase[] = stream.items.map((item) => ({
    id: item.note.id,
    phrase: item.note.phrase,
    createdAt: item.note.created_at,
    audioUrl: item.note.audioUrl,
    replayCount: item.replayCount,
    reason: item.reason,
  }))
  const sessions = normalizeSessions(sessionsData || [])
  const recentPlayers = [
    ...new Set(sessions.map(playerName).filter(Boolean)),
  ].slice(0, 12)
  const repeatedPhrases = clusterCoachingLanguage(
    phrases.map((phrase) => ({
      id: phrase.id,
      phrase: phrase.phrase,
      createdAt: new Date(phrase.createdAt).getTime(),
    }))
  ).map((cluster) => ({
    id: cluster.id,
    label: cluster.label,
    count: cluster.count,
  }))
  const playerMentions = buildPlayerMentions(phrases, recentPlayers)
  const recentSessions = buildSessionCards(phrases, playerMentions)

  return (
    <VoiceMemoryConsole
      recentPhrases={phrases.slice(0, 12)}
      repeatedPhrases={repeatedPhrases}
      playerMentions={playerMentions}
      recentSessions={recentSessions}
    />
  )
}
