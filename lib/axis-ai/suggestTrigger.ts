import { tacticalSystemForSession } from "@/lib/axis/reinforcement"
import type { ReplaySessionView } from "@/types/memory"

export function suggestTrigger(session: ReplaySessionView) {
  if (session.triggerWord?.trim()) {
    return session.triggerWord.trim().toUpperCase()
  }

  return tacticalSystemForSession(session).defaultTrigger
}
