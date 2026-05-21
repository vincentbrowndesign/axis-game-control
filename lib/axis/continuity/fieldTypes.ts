import type { AxisMemoryObject } from "@/lib/axis/types"
import { narrativeSeedsFromTags, type NarrativeSeed } from "@/lib/axis/continuity/narrativeSeeds"

export type SigmaEdgeDirection = "forward" | "backward" | "lateral"

export type SigmaPropagationMode = "forward" | "backward" | "both"

export type SigmaFieldLifecycle = "fresh" | "propagated" | "normalized"

export type SigmaRawContributions = {
  forward: number
  backward: number
  lateral: number
}

export type SigmaDirectionBias = "forward" | "backward" | "balanced"

export type SigmaFieldNode = {
  id: string
  memory: AxisMemoryObject
  baseSigma: number
  sigma: number
  anchor: boolean
  narrativeSeeds: NarrativeSeed[]
  rawContributions: SigmaRawContributions
}

export type SigmaFieldEdge = {
  fromId: string
  toId: string
  direction: SigmaEdgeDirection
  weight: number
  impedance: number
  narrativeSeeds: NarrativeSeed[]
}

export type SigmaContinuityCluster = {
  id: string
  memoryIds: string[]
  sigma: number
  narrativeSeeds: NarrativeSeed[]
  rawContributions: SigmaRawContributions
  directionBias: SigmaDirectionBias
}

export type SigmaField = {
  lifecycle: SigmaFieldLifecycle
  source: "chronology"
  nodes: SigmaFieldNode[]
  edges: SigmaFieldEdge[]
  propagatedFrom: SigmaPropagationMode | null
  normalizedAt: string | null
}

export type SigmaMemoryPackage = {
  source: "sigma_memory_package"
  generatedAt: string
  anchors: Array<{
    memoryId: string
    sigma: number
    narrativeSeeds: NarrativeSeed[]
  }>
  rankedMemoryIds: string[]
  clusters: SigmaContinuityCluster[]
  narrativeSeeds: NarrativeSeed[]
}

export type MemorySliceRef = {
  memoryId: string
  expectedSigmaProfile: {
    dominantClusterSignatures: NarrativeSeed[]
  }
}

export function createFreshSigmaField(memories: AxisMemoryObject[]): SigmaField {
  const nodes: SigmaFieldNode[] = memories.map((memory) => {
    const anchor = Boolean(memory.replayAnchor) || memory.tags.includes("replay")
    const seeds = narrativeSeedsFromTags(memory.tags)

    return {
      id: memory.id,
      memory,
      baseSigma: baseSigmaFromMemory(memory),
      sigma: baseSigmaFromMemory(memory),
      anchor,
      narrativeSeeds: seeds,
      rawContributions: {
        forward: 0,
        backward: 0,
        lateral: 0,
      },
    }
  })

  return {
    lifecycle: "fresh",
    source: "chronology",
    nodes,
    edges: buildSigmaEdges(memories),
    propagatedFrom: null,
    normalizedAt: null,
  }
}

function buildSigmaEdges(memories: AxisMemoryObject[]): SigmaFieldEdge[] {
  return memories.flatMap((memory, index) => {
    const next = memories[index + 1]
    if (!next) return []

    const edges: SigmaFieldEdge[] = [
      {
        fromId: memory.id,
        toId: next.id,
        direction: "forward",
        weight: 0.68,
        impedance: continuityImpedance(memory, next),
        narrativeSeeds: narrativeSeedsFromTags([...memory.tags, ...next.tags]),
      },
      {
        fromId: next.id,
        toId: memory.id,
        direction: "backward",
        weight: 0.34,
        impedance: continuityImpedance(next, memory),
        narrativeSeeds: narrativeSeedsFromTags([...next.tags, ...memory.tags]),
      },
    ]

    if (hasSemanticBridge(memory, next)) {
      edges.push({
        fromId: memory.id,
        toId: next.id,
        direction: "lateral",
        weight: 0.42,
        impedance: 1,
        narrativeSeeds: narrativeSeedsFromTags([...memory.tags, ...next.tags]),
      })
    }

    return edges
  })
}

function baseSigmaFromMemory(memory: AxisMemoryObject) {
  let sigma = 0.18
  if (memory.replayAnchor || memory.tags.includes("replay")) sigma += 0.24
  if (memory.tags.includes("scoring")) sigma += 0.18
  if (memory.tags.includes("turnover") || memory.tags.includes("stop")) sigma += 0.18
  if (memory.tags.includes("rebound")) sigma += 0.12
  return Math.min(1, sigma)
}

function continuityImpedance(from: AxisMemoryObject, to: AxisMemoryObject) {
  let impedance = 1
  if (from.playerIds.some((playerId) => to.playerIds.includes(playerId))) impedance -= 0.18
  if (hasSemanticBridge(from, to)) impedance -= 0.14
  if (from.replayAnchor && to.replayAnchor) impedance -= 0.1
  return Math.max(0.35, impedance)
}

function hasSemanticBridge(from: AxisMemoryObject, to: AxisMemoryObject) {
  return from.tags.some((tag) => to.tags.includes(tag))
}
