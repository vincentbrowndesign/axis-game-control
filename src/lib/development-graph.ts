// ---------------------------------------------------------------------------
// Development Graph
//
// Represents development as a graph of nodes and edges — not a chat history.
//
// Nodes:  Intent → Experiment → Witness → Observation → Outcome
// Edges:  directional relationships between loop steps
//
// Storage: localStorage, key "axis_dev_graph"
// No behavior. No UI. No visualization. Pure data + traversal.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "axis_dev_graph";

// ---------------------------------------------------------------------------
// Node interfaces
// ---------------------------------------------------------------------------

export interface IntentNode {
  type: "intent";
  id: string;
  contextId?: string;
  text: string;
  createdAt: string;
}

export interface ExperimentNode {
  type: "experiment";
  id: string;
  contextId?: string;
  experimentId: string;
  constraint?: string;
  createdAt: string;
}

export interface WitnessNode {
  type: "witness";
  id: string;
  contextId?: string;
  witnessType: string;  // modality: "camera" | "voice" | "coach" etc.
  verdict: string;      // "satisfied" | "violated" | "partial" | "unobservable"
  createdAt: string;
}

export interface ObservationNode {
  type: "observation";
  id: string;
  contextId?: string;
  text: string;
  createdAt: string;
}

export interface OutcomeNode {
  type: "outcome";
  id: string;
  contextId?: string;
  outcome: string;  // OutcomeSignal: "continue" | "advance" | "refine" | "rest"
  createdAt: string;
}

export type DevelopmentNode =
  | IntentNode
  | ExperimentNode
  | WitnessNode
  | ObservationNode
  | OutcomeNode;

// ---------------------------------------------------------------------------
// Edge interface
// ---------------------------------------------------------------------------

export type EdgeType =
  | "intent→experiment"
  | "experiment→witness"
  | "experiment→observation"
  | "witness→observation"
  | "observation→outcome"
  | "outcome→experiment";

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  contextId?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Stored graph shape
// ---------------------------------------------------------------------------

interface StoredGraph {
  nodes: Record<string, DevelopmentNode>;
  edges: GraphEdge[];
}

const EMPTY_GRAPH: StoredGraph = { nodes: {}, edges: [] };

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function load(): StoredGraph {
  if (typeof window === "undefined") return { ...EMPTY_GRAPH, nodes: {}, edges: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: {}, edges: [] };
    return JSON.parse(raw) as StoredGraph;
  } catch {
    return { nodes: {}, edges: [] };
  }
}

function save(graph: StoredGraph): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
  } catch {}
}

// ---------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------

export function addNode(node: DevelopmentNode): void {
  const g = load();
  g.nodes[node.id] = node;
  save(g);
}

export function addEdge(
  from: string,
  to: string,
  type: EdgeType,
  contextId?: string,
): void {
  const g = load();
  const duplicate = g.edges.some(
    (e) => e.from === from && e.to === to && e.type === type,
  );
  if (!duplicate) {
    g.edges.push({ from, to, type, contextId, createdAt: new Date().toISOString() });
    save(g);
  }
}

// ---------------------------------------------------------------------------
// Traversal
// ---------------------------------------------------------------------------

// Returns adjacent nodes in the given direction.
export function getNeighbors(
  nodeId: string,
  direction: "out" | "in" | "both" = "out",
): DevelopmentNode[] {
  const g = load();
  const ids = new Set<string>();
  for (const e of g.edges) {
    if ((direction === "out" || direction === "both") && e.from === nodeId) ids.add(e.to);
    if ((direction === "in" || direction === "both") && e.to === nodeId) ids.add(e.from);
  }
  return [...ids].map((id) => g.nodes[id]).filter(Boolean);
}

// BFS shortest path. Returns node array including start and end.
// Returns [] if no path exists or if either node is unknown.
export function getPath(fromId: string, toId: string): DevelopmentNode[] {
  const g = load();
  if (!g.nodes[fromId] || !g.nodes[toId]) return [];
  if (fromId === toId) return [g.nodes[fromId]];

  const visited = new Set<string>([fromId]);
  const queue: string[][] = [[fromId]];

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    for (const e of g.edges) {
      if (e.from !== current || visited.has(e.to)) continue;
      const next = [...path, e.to];
      if (e.to === toId) return next.map((id) => g.nodes[id]).filter(Boolean);
      visited.add(e.to);
      queue.push(next);
    }
  }

  return [];
}

// Returns all nodes and edges belonging to a context.
// Uses both edge contextId and node contextId as membership signals.
export function getContextGraph(contextId: string): {
  nodes: DevelopmentNode[];
  edges: GraphEdge[];
} {
  const g = load();
  const edges = g.edges.filter((e) => e.contextId === contextId);
  const nodeIds = new Set<string>();

  for (const e of edges) {
    nodeIds.add(e.from);
    nodeIds.add(e.to);
  }
  for (const node of Object.values(g.nodes)) {
    if (node.contextId === contextId) nodeIds.add(node.id);
  }

  const nodes = [...nodeIds].map((id) => g.nodes[id]).filter(Boolean);
  return { nodes, edges };
}

// Returns context nodes in chronological order — useful for history views.
export function getContextTimeline(contextId: string): DevelopmentNode[] {
  const { nodes } = getContextGraph(contextId);
  return nodes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------------------------------------------------------------------------
// Node ID helpers — deterministic, collision-resistant
// ---------------------------------------------------------------------------

export function nodeId(type: DevelopmentNode["type"]): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
