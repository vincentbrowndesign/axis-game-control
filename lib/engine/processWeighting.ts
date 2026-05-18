export type ProcessGrade = "CORRECT" | "NEUTRAL" | "BROKEN"
export type ActionContext =
  | "SYSTEM_LAUNCH"
  | "ASSISTED"
  | "ADVANTAGE"
  | "NEUTRAL"
  | "FORCED"

export function processMultiplier(process: ProcessGrade) {
  if (process === "CORRECT") return 1.25
  if (process === "BROKEN") return -1.25

  return 1
}

export function contextMultiplier(context: ActionContext) {
  if (context === "SYSTEM_LAUNCH") return 1.3
  if (context === "ASSISTED") return 1.2
  if (context === "ADVANTAGE") return 1.15
  if (context === "FORCED") return 0.65

  return 1
}

