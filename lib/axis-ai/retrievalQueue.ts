import {
  isRepeated,
  repeatCounts,
  tagCounts,
  triggerLabel,
} from "@/lib/archive/sessionRollup"
import { tacticalSystemForSession } from "@/lib/axis/reinforcement"
import type { ReplaySessionView } from "@/types/memory"

export function retrievalQueue(sessions: ReplaySessionView[]) {
  const tags = tagCounts(sessions)
  const repeats = repeatCounts(sessions)

  return sessions
    .filter(
      (session) =>
        isRepeated(session, repeats, tags) ||
        !session.coachNote ||
        session.constructionZone
    )
    .slice(0, 12)
    .map((session) => {
      const system = tacticalSystemForSession(session)
      const trigger = triggerLabel(session)

      return {
        label: trigger
          ? `${system.name} / Trigger ${trigger}`
          : `${system.name} / Needs review`,
        href: `/sessions?situation=${encodeURIComponent(system.aliases[0] || system.name)}`,
      }
    })
}
