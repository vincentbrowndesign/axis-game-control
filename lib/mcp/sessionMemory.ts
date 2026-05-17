import type { AxisVoiceNote } from "@/types/memory"

export type SessionMemory = {
  sessionId: string
  notes: AxisVoiceNote[]
  transcript: string
  activeLandmarks: number
  repeatedPhrases: string[]
}

export function buildSessionMemory(notes: AxisVoiceNote[]) {
  const sessions = new Map<string, AxisVoiceNote[]>()

  for (const note of notes) {
    if (!note.session_id) continue

    const current = sessions.get(note.session_id) || []
    current.push(note)
    sessions.set(note.session_id, current)
  }

  return [...sessions.entries()].map(([sessionId, sessionNotes]) => {
    const phraseCounts = new Map<string, number>()

    for (const note of sessionNotes) {
      const phrase = note.normalized_phrase || note.phrase.toLowerCase()
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
    }

    return {
      sessionId,
      notes: sessionNotes,
      transcript: sessionNotes.map((note) => note.phrase).join("\n"),
      activeLandmarks: sessionNotes.length,
      repeatedPhrases: [...phraseCounts.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .map(([phrase]) => phrase),
    } satisfies SessionMemory
  })
}
