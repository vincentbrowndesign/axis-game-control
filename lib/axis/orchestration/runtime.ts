import type { AxisContextPackage } from "@/lib/axis/contextPackage"
import type { NarrativeSeed } from "@/lib/axis/continuity/narrativeSeeds"
import type { AxisStrategicPlan } from "@/lib/axis/orchestration/planner"
import { createRuntimeReceipt, type AxisRuntimeReceipt } from "@/lib/axis/runtime/runtimeReceipts"
import type { AxisIntelligenceOutput, AxisMemoryObject } from "@/lib/axis/types"

export type AxisRuntimeContext = AxisContextPackage & {
  runtimeMode: "live_contextual_query"
  retrieval: {
    depth: AxisStrategicPlan["retrievalDepth"]
    memoryIds: string[]
    narrativeSeeds: NarrativeSeed[]
  }
}

export type AxisRuntimeResult = {
  output: AxisIntelligenceOutput
  runtimeContext: AxisRuntimeContext
  receipt: AxisRuntimeReceipt
}

export function buildRuntimeContext(context: AxisContextPackage, plan: AxisStrategicPlan): AxisRuntimeContext {
  const rankedMemoryIds = context.sigmaMemoryPackage?.rankedMemoryIds ?? context.recentMemory.lastEvents.map((memory) => memory.id)
  const memoryLimit = plan.retrievalDepth === "deep" ? 8 : plan.retrievalDepth === "standard" ? 5 : 3

  return {
    ...context,
    runtimeMode: "live_contextual_query",
    retrieval: {
      depth: plan.retrievalDepth,
      memoryIds: rankedMemoryIds.slice(0, memoryLimit),
      narrativeSeeds: context.sigmaMemoryPackage?.narrativeSeeds ?? [],
    },
  }
}

export function synthesizeRuntimeOutput(
  query: string,
  context: AxisContextPackage,
  plan: AxisStrategicPlan,
): AxisIntelligenceOutput {
  const normalized = query.toLowerCase()
  const memories = selectMemories(query, context)
  const supportingMemoryIds = memories.map((memory) => memory.id)
  const answer = answerFromContinuity(normalized, memories, context)

  return {
    query,
    answer,
    supportingMemoryIds,
    staticOutputs: context.staticAnalytics,
    contextualOutputs: context.continuityState,
    memoryOutputs: plan.retrievalDepth === "deep" ? memories : memories.slice(0, 5),
  }
}

export function createRuntimeResult({
  query,
  context,
  runtimeContext,
  output,
  providerPath,
  confidence,
  provenance,
  startedAt,
}: {
  query: string
  context: AxisContextPackage
  runtimeContext: AxisRuntimeContext
  output: AxisIntelligenceOutput
  providerPath: AxisRuntimeReceipt["providerPath"]
  confidence: number
  provenance: AxisRuntimeReceipt["synthesisProvenance"]
  startedAt: number
}): AxisRuntimeResult {
  const sigma = context.sigmaMemoryPackage
  const receipt = createRuntimeReceipt({
    query,
    providerPath,
    retrievalPath: {
      source: context.kernel.source,
      depth: runtimeContext.retrieval.depth,
      memoryIds: runtimeContext.retrieval.memoryIds,
      narrativeSeeds: runtimeContext.retrieval.narrativeSeeds,
    },
    continuityReceipt: {
      kernelSource: context.kernel.source,
      sigmaPackagePresent: Boolean(sigma),
      continuityReferences: output.supportingMemoryIds,
    },
    sigmaLineage: {
      rankedMemoryIds: sigma?.rankedMemoryIds ?? [],
      clusterIds: sigma?.clusters.map((cluster) => cluster.id) ?? [],
      narrativeSeeds: sigma?.narrativeSeeds ?? [],
    },
    runtimeLatencyMs: Date.now() - startedAt,
    confidence,
    synthesisProvenance: provenance,
  })

  return {
    output,
    runtimeContext,
    receipt,
  }
}

function selectMemories(query: string, context: AxisContextPackage) {
  const normalized = query.toLowerCase()
  const memories = context.recentMemory.lastEvents
  const sigmaRank = context.sigmaMemoryPackage?.rankedMemoryIds ?? []
  const ranked = sigmaRank.flatMap((id) => memories.find((memory) => memory.id === id) ?? [])
  const base = ranked.length ? ranked : memories

  if (/\brebounds?|boards?\b/.test(normalized)) return byTag(base, "rebound")
  if (/\bpressure|unstable\b/.test(normalized)) return byAnyTag(base, ["pressure", "stop", "turnover"])
  if (/\btransition\b/.test(normalized)) return byTag(base, "transition")
  if (/\bcollapse|turnover chains?\b/.test(normalized)) return byAnyTag(base, ["turnover", "pressure"])
  if (/\bbefore the run|possessions before\b/.test(normalized)) return beforeRun(base)
  if (/\b#4\b/.test(normalized)) return base.filter((memory) => memory.playerIds.includes("#4"))
  if (/\breview\b/.test(normalized)) return byReplay(base)
  return base
}

function answerFromContinuity(query: string, memories: AxisMemoryObject[], context: AxisContextPackage) {
  if (!memories.length) return "No matching memory yet."

  if (/\bwho stabilized\b/.test(query)) {
    return context.continuityState.stabilizationMoment ?? memories[0].label
  }

  if (/\bcaused the collapse\b|\bcollapse\b/.test(query)) {
    return context.continuityState.pressureShift ?? memories.find((memory) => memory.tags.includes("turnover"))?.label ?? memories[0].label
  }

  if (/\b#4\b/.test(query)) {
    const player = context.staticAnalytics.players.find((line) => line.id === "#4")
    if (player) {
      return `#4: ${player.points} points, ${player.rebounds} rebounds, ${player.turnovers} turnovers.`
    }
  }

  if (/\breview\b/.test(query)) {
    return context.continuityState.stabilizationMoment ?? memories.find((memory) => memory.replayAnchor)?.label ?? memories[0].label
  }

  return memories.map((memory) => memory.label).join(" / ")
}

function byTag(memories: AxisMemoryObject[], tag: string) {
  return memories.filter((memory) => memory.tags.includes(tag))
}

function byAnyTag(memories: AxisMemoryObject[], tags: string[]) {
  return memories.filter((memory) => tags.some((tag) => memory.tags.includes(tag)))
}

function byReplay(memories: AxisMemoryObject[]) {
  return memories.filter((memory) => memory.replayAnchor)
}

function beforeRun(memories: AxisMemoryObject[]) {
  const runIndex = memories.findIndex((memory) => memory.tags.includes("run") || memory.tags.includes("scoring"))
  if (runIndex <= 0) return memories
  return memories.slice(0, runIndex)
}
