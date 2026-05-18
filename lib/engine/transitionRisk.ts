export type MissRisk =
  | "DEAD_BALL"
  | "OREB_RECOVERED"
  | "NORMAL"
  | "LIVE_BALL"
  | "LIVE_BALL_RUNOUT"

export function riskMultiplier(risk: MissRisk | undefined, outcome: "PLUS" | "MINUS") {
  if (outcome === "PLUS") return 1
  if (risk === "DEAD_BALL") return 0.25
  if (risk === "OREB_RECOVERED") return 0.15
  if (risk === "LIVE_BALL") return 1.75
  if (risk === "LIVE_BALL_RUNOUT") return 2.25

  return 1
}
