import type { MemoryArchiveItem } from "@/lib/archive/types"
import { buildMemoryConnections } from "@/lib/connections/buildMemoryConnections"
import type { MemoryConnection } from "@/lib/connections/types"

export type ContinuityGraphNodeKind =
  | "memory"
  | "player"
  | "warmup"
  | "team"
  | "spurts"

export type ContinuityGraphNode = {
  id: string
  kind: ContinuityGraphNodeKind
  label: string
}

export type ContinuityGraphEdge = {
  id: string
  from: string
  to: string
  label: string
  confidence: number
}

export type ContinuityGraph = {
  nodes: ContinuityGraphNode[]
  edges: ContinuityGraphEdge[]
  connections: MemoryConnection[]
}

function addNode(
  nodes: Map<string, ContinuityGraphNode>,
  node: ContinuityGraphNode
) {
  if (!nodes.has(node.id)) nodes.set(node.id, node)
}

export function buildContinuityGraph(
  memories: MemoryArchiveItem[]
): ContinuityGraph {
  const nodes = new Map<string, ContinuityGraphNode>()
  const edges: ContinuityGraphEdge[] = []
  const connections = buildMemoryConnections(memories)

  for (const item of memories) {
    addNode(nodes, {
      id: item.session.id,
      kind: "memory",
      label: item.session.title || "Memory",
    })

    if (item.twinId) {
      addNode(nodes, {
        id: `player:${item.twinId}`,
        kind: "player",
        label: item.session.player || "LOCAL PLAYER",
      })
      edges.push({
        id: `${item.twinId}:${item.session.id}:owns`,
        from: `player:${item.twinId}`,
        to: item.session.id,
        label: "anchors memory",
        confidence: 1,
      })
    }

    if (item.warmupId) {
      addNode(nodes, {
        id: `warmup:${item.warmupId}`,
        kind: "warmup",
        label: item.warmupId,
      })
      edges.push({
        id: `${item.warmupId}:${item.session.id}:contains`,
        from: `warmup:${item.warmupId}`,
        to: item.session.id,
        label: "contains memory",
        confidence: 1,
      })
    }

    if (item.session.environment === "game") {
      addNode(nodes, {
        id: "spurts:live-team-memory",
        kind: "spurts",
        label: "Spurts Live Team Memory",
      })
      edges.push({
        id: `spurts:${item.session.id}:game-flow`,
        from: "spurts:live-team-memory",
        to: item.session.id,
        label: "game memory",
        confidence: 0.72,
      })
    }
  }

  for (const connection of connections) {
    edges.push({
      id: connection.id,
      from: connection.fromMemoryId,
      to: connection.toMemoryId,
      label: connection.type.replace(/_/g, " "),
      confidence: connection.confidence,
    })
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    connections,
  }
}
