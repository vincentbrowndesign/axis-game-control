import Link from "next/link"
import { redirect } from "next/navigation"
import UploadMemoryConsole from "@/components/UploadMemoryConsole"
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

type HomeReplayMoment = {
  id: string
  sessionId: string
  title: string
  caption: string
  detail: string
  timestamp: string
  videoUrl?: string | null
  sessionTitle: string
}

type HomeSession = {
  id: string
  title: string
  time: string
  videoUrl?: string | null
  captions: string[]
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

function metadataLandmarks(metadata: Record<string, unknown> | null) {
  const landmarks = metadata?.candidateLandmarks || metadata?.captionLandmarks

  if (!Array.isArray(landmarks)) return []

  return landmarks
    .map((landmark, index) => {
      if (!landmark || typeof landmark !== "object") return null

      const current = landmark as Record<string, unknown>
      const title =
        typeof current.title === "string" ? current.title : "Replay moment"
      const caption =
        typeof current.caption === "string"
          ? current.caption
          : title.toUpperCase()
      const detail =
        typeof current.detail === "string"
          ? current.detail
          : "Coach adds the meaning."
      const timestamp =
        typeof current.timestamp === "string"
          ? current.timestamp
          : formatTimestamp(
              typeof current.timestampSeconds === "number"
                ? current.timestampSeconds
                : index * 12
            )

      return {
        title,
        caption,
        detail,
        timestamp,
      }
    })
    .filter(
      (
        landmark
      ): landmark is {
        title: string
        caption: string
        detail: string
        timestamp: string
      } => Boolean(landmark)
    )
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
            Upload basketball footage.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Axis extracts replay moments, timestamps, and captions.
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
  const playerMentions = buildPlayerMentions(phrases, recentPlayers)
  const recentSessions: HomeSession[] = (sessionsData || []).map((session) => {
    const landmarks = metadataLandmarks(session.metadata)

    return {
      id: session.id,
      title: session.title || session.file_name || "Basketball video",
      time: sessionDay(session.created_at),
      videoUrl: session.video_url || null,
      captions: landmarks.map((landmark) => landmark.caption).slice(0, 3),
    }
  })
  const replayMoments: HomeReplayMoment[] = (sessionsData || []).flatMap(
    (session) =>
      metadataLandmarks(session.metadata).map((landmark, index) => ({
        id: `${session.id}-${index}`,
        sessionId: session.id,
        title: landmark.title,
        caption: landmark.caption,
        detail: landmark.detail,
        timestamp: landmark.timestamp,
        videoUrl: session.video_url || null,
        sessionTitle: session.title || session.file_name || "Basketball video",
      }))
  )

  return (
    <UploadMemoryConsole
      replayMoments={replayMoments}
      recentSessions={recentSessions}
      playerMoments={playerMentions.map((mention) => ({
        name: mention.name,
        phrase: mention.latestPhrase,
        count: mention.count,
      }))}
    />
  )
}
