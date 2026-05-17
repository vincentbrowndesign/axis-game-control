import {
  clusterCoachingLanguage,
  type CoachingLanguageCluster,
} from "@/lib/axis-ai/clusterCoachingLanguage"
import { buildLandmarkMemory, type LandmarkMemory } from "@/lib/mcp/landmarkMemory"
import {
  buildPlayerMemory,
  detectPlayerMention,
  type PlayerMemory,
} from "@/lib/mcp/playerMemory"
import {
  getReplayMemory,
  replayReason,
  scoreReplayPriority,
} from "@/lib/mcp/replayMemory"
import { buildSessionMemory, type SessionMemory } from "@/lib/mcp/sessionMemory"
import type { AxisVoiceNote } from "@/types/memory"

export type ReinforcementMemoryItem<TNote extends AxisVoiceNote = AxisVoiceNote> = {
  note: TNote
  score: number
  replayCount: number
  recurrenceCount: number
  playerMention?: string
  reason: string
  landmarkMemory: LandmarkMemory
}

export type ReinforcementMemoryContext<
  TNote extends AxisVoiceNote = AxisVoiceNote,
> = {
  items: ReinforcementMemoryItem<TNote>[]
  clusters: CoachingLanguageCluster[]
  players: PlayerMemory[]
  sessions: SessionMemory[]
}

function noteAgeHours(note: AxisVoiceNote) {
  const createdAt = new Date(note.created_at).getTime()
  if (Number.isNaN(createdAt)) return 999

  return Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60))
}

function clusterCountsByNote(clusters: CoachingLanguageCluster[]) {
  const counts = new Map<string, number>()

  for (const cluster of clusters) {
    for (const phrase of cluster.phrases) {
      if (phrase.id) counts.set(phrase.id, cluster.count)
    }
  }

  return counts
}

export function buildReinforcementMemory<
  TNote extends AxisVoiceNote = AxisVoiceNote,
>({
  notes,
  playerNames = [],
}: {
  notes: TNote[]
  playerNames?: string[]
}): ReinforcementMemoryContext<TNote> {
  const clusters = clusterCoachingLanguage(
    notes.map((note) => ({
      id: note.id,
      phrase: note.phrase,
      createdAt: new Date(note.created_at).getTime(),
      sessionId: note.session_id || undefined,
      workflowStage: note.workflow_stage || undefined,
    }))
  )
  const clusterCounts = clusterCountsByNote(clusters)

  const items = notes
    .map((note) => {
      const replay = getReplayMemory(note)
      const recurrenceCount = clusterCounts.get(note.id) || 1
      const playerMention = detectPlayerMention(note.phrase, playerNames)
      const ageHours = noteAgeHours(note)
      const score = scoreReplayPriority({
        replayCount: replay.replayCount,
        recurrenceCount,
        hasPlayerMention: Boolean(playerMention),
        ageHours,
      })

      return {
        note,
        score,
        replayCount: replay.replayCount,
        recurrenceCount,
        playerMention,
        reason: replayReason({
          replayCount: replay.replayCount,
          recurrenceCount,
          playerMention,
          ageHours,
        }),
        landmarkMemory: buildLandmarkMemory({
          note,
          notes,
          clusters,
          score,
        }),
      } satisfies ReinforcementMemoryItem<TNote>
    })
    .sort((a, b) => b.score - a.score)

  return {
    items,
    clusters,
    players: buildPlayerMemory({ notes, players: playerNames }),
    sessions: buildSessionMemory(notes),
  }
}
