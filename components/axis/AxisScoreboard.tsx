"use client"

import { useAxisStore } from "@/store/useAxisStore"

export function AxisScoreboard() {
  const score = useAxisStore((state) => state.score)
  const possession = useAxisStore((state) => state.possession)

  return (
    <div className="axis-v2-scoreboard" aria-label="Axis scoreboard">
      <span>HOME {score.home}</span>
      <span>{possession}</span>
      <span>AWAY {score.away}</span>
    </div>
  )
}
