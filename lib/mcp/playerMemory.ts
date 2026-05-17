import type { AxisVoiceNote } from "@/types/memory"

export type PlayerMemory = {
  player: string
  notes: AxisVoiceNote[]
  repeatedPhrases: string[]
  lastMentionedAt: string | null
}

function phraseHasPlayer(phrase: string, player: string) {
  const lowerPhrase = ` ${phrase.toLowerCase()} `
  const lowerPlayer = player.toLowerCase()

  return lowerPhrase.includes(` ${lowerPlayer} `)
}

export function detectPlayerMention(phrase: string, players: string[]) {
  return players.find((player) => phraseHasPlayer(phrase, player))
}

export function buildPlayerMemory({
  notes,
  players,
}: {
  notes: AxisVoiceNote[]
  players: string[]
}) {
  return players
    .map((player) => {
      const playerNotes = notes.filter((note) =>
        phraseHasPlayer(note.phrase, player)
      )
      const phraseCounts = new Map<string, number>()

      for (const note of playerNotes) {
        const phrase = note.normalized_phrase || note.phrase.toLowerCase()
        phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
      }

      const repeatedPhrases = [...phraseCounts.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .map(([phrase]) => phrase)

      return {
        player,
        notes: playerNotes,
        repeatedPhrases,
        lastMentionedAt: playerNotes[0]?.created_at || null,
      } satisfies PlayerMemory
    })
    .filter((memory) => memory.notes.length > 0)
}
