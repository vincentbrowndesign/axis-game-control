import type { TeamSide } from "@/lib/session/types"

export type RunState = {
  side: TeamSide | null
  label: string
  pointsFor: number
  pointsAgainst: number
}
