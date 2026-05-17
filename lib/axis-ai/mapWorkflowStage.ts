import type { ReplaySessionView, WorkflowStage } from "@/types/memory"

export const WORKFLOW_STAGES: {
  value: WorkflowStage
  label: string
}[] = [
  { value: "GET_THERE", label: "Get there" },
  { value: "DRILL", label: "Drill" },
  { value: "SCRIMMAGE", label: "Scrimmage" },
  { value: "REVIEW", label: "Review" },
  { value: "GAME", label: "Game" },
]

export function workflowStageLabel(stage?: WorkflowStage | null) {
  return WORKFLOW_STAGES.find((item) => item.value === stage)?.label || "Drill"
}

export function mapWorkflowStage(value: unknown): WorkflowStage {
  if (
    value === "GET_THERE" ||
    value === "DRILL" ||
    value === "SCRIMMAGE" ||
    value === "REVIEW" ||
    value === "GAME"
  ) {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase()

    if (normalized.includes("game")) return "GAME"
    if (normalized.includes("scrimmage") || normalized.includes("live")) {
      return "SCRIMMAGE"
    }
    if (normalized.includes("review") || normalized.includes("film")) {
      return "REVIEW"
    }
    if (normalized.includes("arrival") || normalized.includes("setup")) {
      return "GET_THERE"
    }
  }

  return "DRILL"
}

export function stageForSession(session: ReplaySessionView): WorkflowStage {
  return session.workflowStage || mapWorkflowStage(session.environment)
}
