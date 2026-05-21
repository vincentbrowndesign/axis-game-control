import type { AxisContextPackage } from "@/lib/axis/contextPackage"
import type { AxisProviderName } from "@/lib/axis/runtime/runtimeReceipts"

export type AxisRetrievalDepth = "shallow" | "standard" | "deep"

export type AxisStrategicPlan = {
  provider: AxisProviderName
  providerRole: "runtime_synthesis" | "secondary_critique" | "external_grounding" | "local_synthesis"
  retrievalDepth: AxisRetrievalDepth
  requiresExternalSearch: boolean
  requiresChronologyRebuild: boolean
  requiresReplayContext: boolean
}

export function createStrategicPlan(query: string, context: AxisContextPackage): AxisStrategicPlan {
  const normalized = query.toLowerCase()
  const requiresExternalSearch = /\b(latest|today|news|research|paper|rule change|outside)\b/.test(normalized)
  const requiresReplayContext = /\breplay|clip|review|possessions?|before|after\b/.test(normalized)
  const requiresChronologyRebuild = context.kernel.source === "chronology"
  const retrievalDepth: AxisRetrievalDepth = /\bchains?|collapse|before|unstable|caused|impact\b/.test(normalized)
    ? "deep"
    : /\brebounds?|pressure|transition|review|stabilized\b/.test(normalized)
      ? "standard"
      : "shallow"

  if (requiresExternalSearch) {
    return {
      provider: "perplexity",
      providerRole: "external_grounding",
      retrievalDepth,
      requiresExternalSearch,
      requiresChronologyRebuild,
      requiresReplayContext,
    }
  }

  if (/\bcritique|audit|cheap|secondary\b/.test(normalized)) {
    return {
      provider: "deepseek",
      providerRole: "secondary_critique",
      retrievalDepth,
      requiresExternalSearch,
      requiresChronologyRebuild,
      requiresReplayContext,
    }
  }

  return {
    provider: "openai",
    providerRole: "runtime_synthesis",
    retrievalDepth,
    requiresExternalSearch,
    requiresChronologyRebuild,
    requiresReplayContext,
  }
}
