import Link from "next/link"
import { redirect } from "next/navigation"
import VoiceMemoryConsole from "@/components/VoiceMemoryConsole"
import { clusterCoachingLanguage } from "@/lib/axis-ai/clusterCoachingLanguage"
import {
  normalizeSessions,
  playerName,
} from "@/lib/archive/sessionRollup"
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
}

type PlayerMention = {
  name: string
  count: number
  latestPhrase: string
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
            Voice notes for basketball coaching.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Tap record, coach normally, and keep the phrases that keep coming back.
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

  const phrases: VoicePhrase[] = (voiceNotes || []).map((note) => ({
    id: note.id,
    phrase: note.phrase,
    createdAt: note.created_at,
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

  return (
    <VoiceMemoryConsole
      recentPhrases={phrases.slice(0, 12)}
      repeatedPhrases={repeatedPhrases}
      playerMentions={playerMentions}
    />
  )
}
