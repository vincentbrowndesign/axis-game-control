import type { AxisMemoryObject } from "@/lib/axisMemoryObject"
import type { AxisContextualMemoryPackage } from "@/lib/contextualMemoryLanguage"

export type AxisMemoryGraphEdgeType =
  | "chronology"
  | "possession"
  | "replay"
  | "player"
  | "semantic"
  | "continuity"
  | "spatial"
  | "pressure"

export type AxisMemoryGraphEdge = {
  fromEventId: string
  toEventId: string
  type: AxisMemoryGraphEdgeType
  weight: number
  evidence: string[]
}

export type AxisStateDependentMemoryGraph = {
  nodes: AxisMemoryObject[]
  edges: AxisMemoryGraphEdge[]
  stateSummary: {
    activeScore: string | null
    activePossession: string | null
    recentFlow: string[]
    graphTruth: "chronology_ready" | "context_ready" | "thin_context"
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function addEdge(
  edges: AxisMemoryGraphEdge[],
  edge: AxisMemoryGraphEdge
) {
  if (edge.fromEventId === edge.toEventId) return

  const existing = edges.find(
    (candidate) =>
      candidate.fromEventId === edge.fromEventId &&
      candidate.toEventId === edge.toEventId &&
      candidate.type === edge.type
  )

  if (existing) {
    existing.weight = Math.max(existing.weight, edge.weight)
    existing.evidence = [...new Set([...existing.evidence, ...edge.evidence])]
    return
  }

  edges.push({
    ...edge,
    weight: clamp01(edge.weight),
  })
}

function semanticOverlap(a: AxisMemoryObject, b: AxisMemoryObject) {
  const aTags = new Set(a.semanticTags || [])
  const bTags = new Set(b.semanticTags || [])
  const overlap = [...aTags].filter((tag) => bTags.has(tag))

  return overlap
}

function hasContinuityState(memory: AxisMemoryObject) {
  return Boolean(memory.continuityState && Object.keys(memory.continuityState).length)
}

export function buildStateDependentMemoryGraph({
  memories,
  contextPackage,
}: {
  memories: AxisMemoryObject[]
  contextPackage: AxisContextualMemoryPackage
}): AxisStateDependentMemoryGraph {
  const nodes = memories.slice(-24)
  const edges: AxisMemoryGraphEdge[] = []

  nodes.forEach((memory, index) => {
    const next = nodes[index + 1]
    if (!next) return

    addEdge(edges, {
      fromEventId: memory.eventId,
      toEventId: next.eventId,
      type: "chronology",
      weight: 0.92,
      evidence: ["same live chronology"],
    })

    if (memory.possessionAfter && memory.possessionAfter === next.possessionBefore) {
      addEdge(edges, {
        fromEventId: memory.eventId,
        toEventId: next.eventId,
        type: "possession",
        weight: 0.74,
        evidence: ["possession carried into next memory"],
      })
    }

    if (memory.replayAnchor && next.replayAnchor) {
      const distance = Math.abs(memory.replayAnchor.sessionTime - next.replayAnchor.sessionTime)
      if (distance <= 32) {
        addEdge(edges, {
          fromEventId: memory.eventId,
          toEventId: next.eventId,
          type: "replay",
          weight: 0.7 - distance / 80,
          evidence: ["nearby replay anchors"],
        })
      }
    }

    if (memory.player && memory.player === next.player) {
      addEdge(edges, {
        fromEventId: memory.eventId,
        toEventId: next.eventId,
        type: "player",
        weight: 0.78,
        evidence: ["same player carried through memory"],
      })
    }

    const overlap = semanticOverlap(memory, next)
    if (overlap.length) {
      addEdge(edges, {
        fromEventId: memory.eventId,
        toEventId: next.eventId,
        type: "semantic",
        weight: 0.5 + Math.min(0.28, overlap.length * 0.08),
        evidence: overlap,
      })
    }

    if (hasContinuityState(memory) && hasContinuityState(next)) {
      addEdge(edges, {
        fromEventId: memory.eventId,
        toEventId: next.eventId,
        type: "continuity",
        weight: 0.68,
        evidence: ["continuity state exists on both moments"],
      })
    }

    if (memory.spatialMetadata && next.spatialMetadata) {
      addEdge(edges, {
        fromEventId: memory.eventId,
        toEventId: next.eventId,
        type: "spatial",
        weight: 0.42,
        evidence: ["spatial context prepared"],
      })
    }
  })

  const score = contextPackage.currentState.score
  const recentFlow = nodes.slice(-6).map((memory) => memory.eventType)

  return {
    nodes,
    edges: edges.sort((a, b) => b.weight - a.weight),
    stateSummary: {
      activeScore: score ? `${score.home}-${score.away}` : null,
      activePossession: contextPackage.currentState.possession,
      recentFlow,
      graphTruth: edges.length >= 5 ? "context_ready" : nodes.length ? "chronology_ready" : "thin_context",
    },
  }
}
