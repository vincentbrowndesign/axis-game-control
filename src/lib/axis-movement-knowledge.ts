import type { AxisCourtZone, AxisEvent, AxisEventType } from "./axis-primitives";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MovementCategory =
  | "ball_movement"
  | "off_ball_movement"
  | "defensive_movement"
  | "transition"
  | "set_action";

export type MovementInitiator =
  | "ball_handler"
  | "off_ball"
  | "defender"
  | "team";

export type MovementRelationshipType =
  | "triggers"   // from almost always causes to (causal)
  | "precedes"   // from frequently comes before to (temporal)
  | "enables"    // from creates spatial/temporal conditions for to
  | "counters"   // from is defensive response to to
  | "follows";   // to is typical reaction after from

export type MovementNode = {
  id: string;
  name: string;        // canonical snake_case, e.g. "weak_side_rotation"
  display_name: string; // e.g. "Weak Side Rotation"
  category: MovementCategory;
  initiator: MovementInitiator;
  typical_origin_zones: AxisCourtZone[];
  typical_terminus_zones: AxisCourtZone[];
  typical_duration_ms: [number, number]; // [min, max]
  tags: string[];
  description: string;
  // Maps to AxisEventType(s) that correspond to this node
  event_types: AxisEventType[];
  occurrence_count: number;
  example_event_ids: string[];
};

export type MovementRelationship = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  type: MovementRelationshipType;
  frequency: number;      // 0–1: proportion of from_node occurrences that lead to to_node
  mean_gap_ms: number;    // typical ms between end of from and start of to
  required_zone_from?: AxisCourtZone;
  required_zone_to?: AxisCourtZone;
  confidence: number;
};

export type PatternStep = {
  node_id: string;
  position: number;     // 1-indexed in sequence
  required: boolean;
  max_gap_ms?: number;  // max allowed time to next step
};

export type MovementPattern = {
  id: string;
  name: string;         // e.g. "drive_and_kick"
  display_name: string; // e.g. "Drive and Kick"
  description: string;
  sequence: PatternStep[];
  relationship_ids: string[];
  typical_zones: AxisCourtZone[];
  tags: string[];
  occurrence_count: number;
  mean_duration_ms: number;
};

export type MovementGraph = {
  nodes: MovementNode[];
  relationships: MovementRelationship[];
};

export type MovementGraphOptions = {
  maxRelationshipGapMs?: number;
  seedNodes?: MovementNode[];
};

// ─── Seed: Movement nodes (the Wikipedia entries) ────────────────────────────

export const MOVEMENT_NODES: MovementNode[] = [
  {
    id: "node_drive",
    name: "drive",
    display_name: "Drive",
    category: "ball_movement",
    initiator: "ball_handler",
    typical_origin_zones: ["top_key", "wing_left", "wing_right", "mid_range_left", "mid_range_right"],
    typical_terminus_zones: ["paint"],
    typical_duration_ms: [400, 2000],
    tags: ["attack", "downhill", "penetration", "live_dribble"],
    description: "Ball handler attacks the basket downhill off the dribble, moving toward the paint.",
    event_types: ["drive"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_baseline_drive",
    name: "baseline_drive",
    display_name: "Baseline Drive",
    category: "ball_movement",
    initiator: "ball_handler",
    typical_origin_zones: ["corner_left", "corner_right", "wing_left", "wing_right"],
    typical_terminus_zones: ["paint"],
    typical_duration_ms: [400, 1800],
    tags: ["attack", "baseline", "downhill", "penetration"],
    description: "Ball handler drives from the wing or corner along the baseline toward the basket.",
    event_types: ["drive"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_kick",
    name: "kick",
    display_name: "Kick",
    category: "ball_movement",
    initiator: "ball_handler",
    typical_origin_zones: ["paint", "mid_range_left", "mid_range_right"],
    typical_terminus_zones: ["wing_left", "wing_right", "top_key", "corner_left", "corner_right"],
    typical_duration_ms: [200, 600],
    tags: ["pass", "kick_out", "perimeter", "advantage_creation"],
    description: "Pass from a driving or posting ball handler out to a perimeter player, exploiting help defense collapsing.",
    event_types: ["kick", "pass"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_cut",
    name: "cut",
    display_name: "Cut",
    category: "off_ball_movement",
    initiator: "off_ball",
    typical_origin_zones: ["wing_left", "wing_right", "top_key", "corner_left", "corner_right"],
    typical_terminus_zones: ["paint"],
    typical_duration_ms: [500, 2500],
    tags: ["off_ball", "backdoor", "UCLA", "scoring", "basket_cut"],
    description: "Off-ball player makes a decisive cut toward the basket to receive a pass or create space.",
    event_types: ["cut"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_relocate",
    name: "relocate",
    display_name: "Relocate",
    category: "off_ball_movement",
    initiator: "off_ball",
    typical_origin_zones: ["wing_left", "wing_right", "corner_left", "corner_right", "top_key"],
    typical_terminus_zones: ["wing_left", "wing_right", "corner_left", "corner_right", "top_key"],
    typical_duration_ms: [600, 3000],
    tags: ["off_ball", "spacing", "movement", "open_look"],
    description: "Off-ball player relocates to an open area of the floor to improve spacing or prepare to receive.",
    event_types: ["relocate"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_closeout",
    name: "closeout",
    display_name: "Closeout",
    category: "defensive_movement",
    initiator: "defender",
    typical_origin_zones: ["paint", "mid_range_left", "mid_range_right"],
    typical_terminus_zones: ["wing_left", "wing_right", "corner_left", "corner_right", "top_key"],
    typical_duration_ms: [300, 1200],
    tags: ["defense", "closeout", "recovery", "contest"],
    description: "Defender sprints to close out on a perimeter player receiving the ball, contesting the shot while staying in control.",
    event_types: ["closeout"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_rotation",
    name: "rotation",
    display_name: "Rotation",
    category: "defensive_movement",
    initiator: "defender",
    typical_origin_zones: ["wing_left", "wing_right", "top_key"],
    typical_terminus_zones: ["paint", "mid_range_left", "mid_range_right"],
    typical_duration_ms: [400, 2000],
    tags: ["defense", "help", "rotation", "paint_protection"],
    description: "Help-side defender rotates toward the basket to protect the paint when a teammate is beaten.",
    event_types: ["rotation"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_weak_side_rotation",
    name: "weak_side_rotation",
    display_name: "Weak Side Rotation",
    category: "defensive_movement",
    initiator: "defender",
    typical_origin_zones: ["wing_left", "wing_right"],
    typical_terminus_zones: ["paint"],
    typical_duration_ms: [500, 2000],
    tags: ["defense", "weak_side", "help", "rotation", "paint_protection"],
    description: "Weak-side defender rotates from the opposite side of the floor to help protect the paint when a baseline drive penetrates.",
    event_types: ["rotation"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_transition",
    name: "transition",
    display_name: "Transition",
    category: "transition",
    initiator: "team",
    typical_origin_zones: ["backcourt", "transition"],
    typical_terminus_zones: ["paint", "wing_left", "wing_right"],
    typical_duration_ms: [1000, 5000],
    tags: ["fast_break", "numbers_advantage", "push", "conversion"],
    description: "Offense pushes the ball up the floor in transition before the defense can set.",
    event_types: ["transition"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_post_entry",
    name: "post_entry",
    display_name: "Post Entry",
    category: "ball_movement",
    initiator: "ball_handler",
    typical_origin_zones: ["wing_left", "wing_right"],
    typical_terminus_zones: ["paint"],
    typical_duration_ms: [300, 800],
    tags: ["post", "entry_pass", "interior"],
    description: "Pass from perimeter into a post player established in the paint or low block.",
    event_types: ["post_entry", "pass"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_hand_off",
    name: "hand_off",
    display_name: "Dribble Hand-Off",
    category: "set_action",
    initiator: "ball_handler",
    typical_origin_zones: ["top_key", "wing_left", "wing_right", "mid_range_left", "mid_range_right"],
    typical_terminus_zones: ["top_key", "wing_left", "wing_right"],
    typical_duration_ms: [500, 2000],
    tags: ["dho", "hand_off", "set_action", "screen_alternative"],
    description: "Ball handler hands the ball to a teammate coming off a dribble, acting as a moving screen.",
    event_types: ["hand_off"],
    occurrence_count: 0,
    example_event_ids: [],
  },
  {
    id: "node_screen",
    name: "screen",
    display_name: "Screen",
    category: "set_action",
    initiator: "off_ball",
    typical_origin_zones: ["top_key", "wing_left", "wing_right", "mid_range_left", "mid_range_right"],
    typical_terminus_zones: ["top_key", "wing_left", "wing_right"],
    typical_duration_ms: [500, 3000],
    tags: ["screen", "ball_screen", "off_ball_screen", "action"],
    description: "Player sets a screen to free a teammate, creating separation from a defender.",
    event_types: ["screen"],
    occurrence_count: 0,
    example_event_ids: [],
  },
];

// ─── Seed: Movement relationships ─────────────────────────────────────────────

export const MOVEMENT_RELATIONSHIPS: MovementRelationship[] = [
  // Drive → Kick (the primary drive-and-kick chain)
  {
    id: "rel_drive_kick",
    from_node_id: "node_drive",
    to_node_id: "node_kick",
    type: "triggers",
    frequency: 0.55,
    mean_gap_ms: 800,
    confidence: 0.85,
  },
  // Drive → Rotation (weak-side help rotates on penetration)
  {
    id: "rel_drive_rotation",
    from_node_id: "node_drive",
    to_node_id: "node_rotation",
    type: "triggers",
    frequency: 0.70,
    mean_gap_ms: 600,
    confidence: 0.88,
  },
  // Baseline drive → Weak side rotation (specific spatial version)
  {
    id: "rel_baseline_drive_weak_side_rotation",
    from_node_id: "node_baseline_drive",
    to_node_id: "node_weak_side_rotation",
    type: "triggers",
    frequency: 0.72,
    mean_gap_ms: 550,
    required_zone_from: "wing_left",
    required_zone_to: "paint",
    confidence: 0.90,
  },
  // Kick → Closeout (perimeter pass forces defender to close out)
  {
    id: "rel_kick_closeout",
    from_node_id: "node_kick",
    to_node_id: "node_closeout",
    type: "triggers",
    frequency: 0.80,
    mean_gap_ms: 400,
    confidence: 0.87,
  },
  // Closeout → Drive (over-aggressive closeout creates drive opportunity)
  {
    id: "rel_closeout_drive",
    from_node_id: "node_closeout",
    to_node_id: "node_drive",
    type: "enables",
    frequency: 0.45,
    mean_gap_ms: 500,
    confidence: 0.78,
  },
  // Rotation → Kick (rotation leaves corner open for kick)
  {
    id: "rel_rotation_kick",
    from_node_id: "node_rotation",
    to_node_id: "node_kick",
    type: "enables",
    frequency: 0.40,
    mean_gap_ms: 300,
    confidence: 0.72,
  },
  // Relocate → Kick (player relocates to receive kick)
  {
    id: "rel_relocate_kick",
    from_node_id: "node_relocate",
    to_node_id: "node_kick",
    type: "enables",
    frequency: 0.55,
    mean_gap_ms: 800,
    confidence: 0.80,
  },
  // Cut → (receive pass / shot_attempt)
  {
    id: "rel_cut_shot",
    from_node_id: "node_cut",
    to_node_id: "node_kick",
    type: "enables",
    frequency: 0.48,
    mean_gap_ms: 400,
    confidence: 0.74,
  },
  // Drive → Cut (drive collapses defense, enabling backdoor cut)
  {
    id: "rel_drive_cut",
    from_node_id: "node_drive",
    to_node_id: "node_cut",
    type: "enables",
    frequency: 0.30,
    mean_gap_ms: 700,
    confidence: 0.70,
  },
  // Screen → Drive (coming off screen creates drive opportunity)
  {
    id: "rel_screen_drive",
    from_node_id: "node_screen",
    to_node_id: "node_drive",
    type: "enables",
    frequency: 0.50,
    mean_gap_ms: 600,
    confidence: 0.80,
  },
  // Transition → Drive (transition advantage leads to attacking drives)
  {
    id: "rel_transition_drive",
    from_node_id: "node_transition",
    to_node_id: "node_drive",
    type: "precedes",
    frequency: 0.60,
    mean_gap_ms: 1200,
    confidence: 0.75,
  },
  // Post entry → Rotation (post entry forces help rotation)
  {
    id: "rel_post_entry_rotation",
    from_node_id: "node_post_entry",
    to_node_id: "node_rotation",
    type: "triggers",
    frequency: 0.65,
    mean_gap_ms: 700,
    confidence: 0.82,
  },
];

// ─── Seed: Named patterns (the Wikipedia "articles") ─────────────────────────

export const MOVEMENT_PATTERNS: MovementPattern[] = [
  {
    id: "pattern_drive_and_kick",
    name: "drive_and_kick",
    display_name: "Drive and Kick",
    description: "Ball handler attacks downhill, defense collapses, pass to open perimeter shooter.",
    sequence: [
      { node_id: "node_drive", position: 1, required: true, max_gap_ms: 1000 },
      { node_id: "node_kick", position: 2, required: true },
    ],
    relationship_ids: ["rel_drive_kick"],
    typical_zones: ["paint", "wing_left", "wing_right"],
    tags: ["attack", "advantage_creation", "perimeter"],
    occurrence_count: 0,
    mean_duration_ms: 2200,
  },
  {
    id: "pattern_baseline_drive_weak_side_rotation",
    name: "baseline_drive_weak_side_rotation",
    display_name: "Baseline Drive — Weak Side Rotation",
    description: "Baseline drive forces weak-side defender to abandon their assignment and rotate to protect the paint.",
    sequence: [
      { node_id: "node_baseline_drive", position: 1, required: true, max_gap_ms: 600 },
      { node_id: "node_weak_side_rotation", position: 2, required: true },
    ],
    relationship_ids: ["rel_baseline_drive_weak_side_rotation"],
    typical_zones: ["wing_left", "paint"],
    tags: ["defense", "drive", "rotation", "weak_side"],
    occurrence_count: 0,
    mean_duration_ms: 1800,
  },
  {
    id: "pattern_drive_kick_closeout_drive",
    name: "drive_kick_closeout_drive",
    display_name: "Drive, Kick, Closeout, Drive Again",
    description: "Penetration creates kick-out. Aggressive closeout on the receiver creates second drive.",
    sequence: [
      { node_id: "node_drive", position: 1, required: true, max_gap_ms: 1000 },
      { node_id: "node_kick", position: 2, required: true, max_gap_ms: 500 },
      { node_id: "node_closeout", position: 3, required: true, max_gap_ms: 1200 },
      { node_id: "node_drive", position: 4, required: true },
    ],
    relationship_ids: ["rel_drive_kick", "rel_kick_closeout", "rel_closeout_drive"],
    typical_zones: ["paint", "wing_left", "wing_right"],
    tags: ["secondary_break", "second_drive", "chain_action"],
    occurrence_count: 0,
    mean_duration_ms: 4500,
  },
  {
    id: "pattern_transition_drive",
    name: "transition_attack",
    display_name: "Transition Attack",
    description: "Push in transition before defense sets, leading to a rim attack.",
    sequence: [
      { node_id: "node_transition", position: 1, required: true, max_gap_ms: 3000 },
      { node_id: "node_drive", position: 2, required: true },
    ],
    relationship_ids: ["rel_transition_drive"],
    typical_zones: ["backcourt", "transition", "paint"],
    tags: ["transition", "fast_break", "numbers_advantage"],
    occurrence_count: 0,
    mean_duration_ms: 4000,
  },
  {
    id: "pattern_relocate_kick",
    name: "relocate_and_receive",
    display_name: "Relocate and Receive",
    description: "Off-ball player relocates to open space, receives kick pass from driver.",
    sequence: [
      { node_id: "node_relocate", position: 1, required: true, max_gap_ms: 2000 },
      { node_id: "node_kick", position: 2, required: true },
    ],
    relationship_ids: ["rel_relocate_kick"],
    typical_zones: ["corner_left", "corner_right", "wing_left", "wing_right"],
    tags: ["spacing", "off_ball", "corner_three"],
    occurrence_count: 0,
    mean_duration_ms: 3000,
  },
  {
    id: "pattern_screen_and_drive",
    name: "pick_and_drive",
    display_name: "Pick and Drive",
    description: "Ball handler uses screen to create driving lane, attacks downhill.",
    sequence: [
      { node_id: "node_screen", position: 1, required: true, max_gap_ms: 1500 },
      { node_id: "node_drive", position: 2, required: true },
    ],
    relationship_ids: ["rel_screen_drive"],
    typical_zones: ["top_key", "wing_left", "wing_right"],
    tags: ["ball_screen", "drive", "set_action"],
    occurrence_count: 0,
    mean_duration_ms: 3500,
  },
];

// ─── Search ───────────────────────────────────────────────────────────────────
// Parse natural-language queries and retrieve matching patterns/nodes.
// Examples:
//   "weak side rotation after baseline drive"
//   "drive and kick"
//   "closeout"

type SearchResult = {
  type: "pattern" | "node" | "relationship";
  id: string;
  name: string;
  display_name: string;
  description: string;
  score: number; // higher = better match
};

// Temporal qualifiers in query language
const TEMPORAL_WORDS: Record<string, MovementRelationshipType[]> = {
  after: ["precedes", "triggers", "enables"],
  before: ["precedes", "enables"],
  because: ["triggers"],
  causes: ["triggers"],
  when: ["triggers", "enables"],
  following: ["follows", "precedes"],
  triggers: ["triggers"],
  enables: ["enables"],
  counters: ["counters"],
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function matchScore(tokens: string[], target: string[]): number {
  let score = 0;
  for (const tok of tokens) {
    for (const t of target) {
      if (t === tok) score += 2;
      else if (t.includes(tok) || tok.includes(t)) score += 1;
    }
  }
  return score;
}

export function searchMovementPatterns(
  query: string,
  nodes = MOVEMENT_NODES,
  relationships = MOVEMENT_RELATIONSHIPS,
  patterns = MOVEMENT_PATTERNS,
): SearchResult[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const results: SearchResult[] = [];

  // ── Match nodes ────────────────────────────────────────────────────────────
  for (const node of nodes) {
    const nodeTokens = [
      node.name,
      ...node.name.split("_"),
      node.display_name.toLowerCase(),
      ...node.tags,
      node.category,
      node.initiator,
      ...node.description.toLowerCase().split(/\s+/),
    ];
    const score = matchScore(tokens, nodeTokens);
    if (score > 0) {
      results.push({
        type: "node",
        id: node.id,
        name: node.name,
        display_name: node.display_name,
        description: node.description,
        score,
      });
    }
  }

  // ── Match patterns ─────────────────────────────────────────────────────────
  for (const pattern of patterns) {
    const patternTokens = [
      pattern.name,
      ...pattern.name.split("_"),
      pattern.display_name.toLowerCase(),
      ...pattern.tags,
      ...pattern.description.toLowerCase().split(/\s+/),
      ...pattern.typical_zones,
    ];
    const score = matchScore(tokens, patternTokens);
    if (score > 0) {
      results.push({
        type: "pattern",
        id: pattern.id,
        name: pattern.name,
        display_name: pattern.display_name,
        description: pattern.description,
        score: score * 1.5, // boost patterns over bare nodes
      });
    }
  }

  // ── Temporal graph traversal ───────────────────────────────────────────────
  // Detect temporal qualifiers (e.g. "after", "following") and pairs of nodes.
  const temporalWord = tokens.find((t) => t in TEMPORAL_WORDS);
  if (temporalWord) {
    const relTypes = TEMPORAL_WORDS[temporalWord];
    const pivotIdx = tokens.indexOf(temporalWord);
    const beforeTokens = tokens.slice(0, pivotIdx);
    const afterTokens = tokens.slice(pivotIdx + 1);

    // Find best matching nodes for each side of the temporal word
    const toNodes = nodes
      .map((n) => ({
        node: n,
        score: matchScore(beforeTokens, [...n.name.split("_"), ...n.tags]),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const fromNodes = nodes
      .map((n) => ({
        node: n,
        score: matchScore(afterTokens, [...n.name.split("_"), ...n.tags]),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    // Traverse relationships: find (from → to) pairs matching (fromNode → toNode)
    for (const fromMatch of fromNodes) {
      for (const toMatch of toNodes) {
        for (const rel of relationships) {
          if (
            rel.from_node_id === fromMatch.node.id &&
            rel.to_node_id === toMatch.node.id &&
            relTypes.includes(rel.type)
          ) {
            // Find patterns that contain this relationship
            const matchedPatterns = patterns.filter((p) =>
              p.relationship_ids.includes(rel.id),
            );
            for (const mp of matchedPatterns) {
              const existing = results.find((r) => r.id === mp.id);
              if (existing) {
                existing.score += 4; // strong temporal boost
              } else {
                results.push({
                  type: "pattern",
                  id: mp.id,
                  name: mp.name,
                  display_name: mp.display_name,
                  description: mp.description,
                  score: 4 + fromMatch.score + toMatch.score,
                });
              }
            }
          }
        }
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i); // deduplicate
}

// ─── Graph traversal utilities ────────────────────────────────────────────────

// Get all nodes that this node triggers or enables
export function getDownstream(
  nodeId: string,
  relationships = MOVEMENT_RELATIONSHIPS,
  nodes = MOVEMENT_NODES,
): MovementNode[] {
  const ids = relationships
    .filter(
      (r) =>
        r.from_node_id === nodeId &&
        (r.type === "triggers" || r.type === "enables" || r.type === "precedes"),
    )
    .map((r) => r.to_node_id);
  return nodes.filter((n) => ids.includes(n.id));
}

// Get all nodes that typically precede / cause this node
export function getUpstream(
  nodeId: string,
  relationships = MOVEMENT_RELATIONSHIPS,
  nodes = MOVEMENT_NODES,
): MovementNode[] {
  const ids = relationships
    .filter((r) => r.to_node_id === nodeId)
    .map((r) => r.from_node_id);
  return nodes.filter((n) => ids.includes(n.id));
}

// Get all patterns that contain a specific node
export function getPatternsContaining(
  nodeId: string,
  patterns = MOVEMENT_PATTERNS,
): MovementPattern[] {
  return patterns.filter((p) => p.sequence.some((s) => s.node_id === nodeId));
}

// Build an observed movement graph from Axis events.
// Input: AxisEvent[]
// Output: MovementNode[] + MovementRelationship[]
export function buildMovementGraphFromEvents(
  events: AxisEvent[],
  options: MovementGraphOptions = {},
): MovementGraph {
  const maxGapMs = options.maxRelationshipGapMs ?? 2500;
  const seedNodes = options.seedNodes ?? MOVEMENT_NODES;
  const sortedEvents = [...events].sort((a, b) => a.started_at - b.started_at || a.frame_start - b.frame_start);
  const nodeMap = new Map<string, MovementNode>();
  const relationshipStats = new Map<
    string,
    {
      confidenceTotal: number;
      count: number;
      fromNodeId: string;
      gapTotal: number;
      toNodeId: string;
      type: MovementRelationshipType;
      zoneFrom?: AxisCourtZone;
      zoneTo?: AxisCourtZone;
    }
  >();

  for (const event of sortedEvents) {
    const node = classifyMovementNode(event, seedNodes);
    if (!node) continue;
    const current = nodeMap.get(node.id) ?? cloneMovementNode(node);
    current.occurrence_count += 1;
    if (!current.example_event_ids.includes(event.id)) current.example_event_ids.push(event.id);
    current.typical_origin_zones = addUniqueZone(current.typical_origin_zones, event.zone);
    if (event.terminus) current.typical_terminus_zones = addUniqueZone(current.typical_terminus_zones, classifyTerminusZone(event));
    current.typical_duration_ms = mergeDurationRange(current.typical_duration_ms, event.ended_at - event.started_at);
    nodeMap.set(current.id, current);
  }

  for (let index = 0; index < sortedEvents.length - 1; index += 1) {
    const fromEvent = sortedEvents[index];
    const fromNode = classifyMovementNode(fromEvent, seedNodes);
    if (!fromNode) continue;

    for (let nextIndex = index + 1; nextIndex < sortedEvents.length; nextIndex += 1) {
      const toEvent = sortedEvents[nextIndex];
      const gap = toEvent.started_at - fromEvent.ended_at;
      if (gap < 0) continue;
      if (gap > maxGapMs) break;

      const toNode = classifyMovementNode(toEvent, seedNodes);
      if (!toNode || toNode.id === fromNode.id) continue;

      const relationshipType = inferRelationshipType(fromEvent, toEvent);
      const key = `${fromNode.id}:${toNode.id}:${relationshipType}`;
      const existing = relationshipStats.get(key) ?? {
        confidenceTotal: 0,
        count: 0,
        fromNodeId: fromNode.id,
        gapTotal: 0,
        toNodeId: toNode.id,
        type: relationshipType,
        zoneFrom: fromEvent.zone,
        zoneTo: toEvent.zone,
      };
      existing.count += 1;
      existing.gapTotal += gap;
      existing.confidenceTotal += (fromEvent.confidence + toEvent.confidence) / 2;
      relationshipStats.set(key, existing);
    }
  }

  const nodes = [...nodeMap.values()].sort((a, b) => b.occurrence_count - a.occurrence_count || a.id.localeCompare(b.id));
  const fromCounts = new Map<string, number>();
  for (const relationship of relationshipStats.values()) {
    fromCounts.set(relationship.fromNodeId, (fromCounts.get(relationship.fromNodeId) ?? 0) + relationship.count);
  }

  const relationships = [...relationshipStats.values()]
    .map((relationship) => ({
      confidence: roundGraphNumber(relationship.confidenceTotal / Math.max(1, relationship.count)),
      frequency: roundGraphNumber(relationship.count / Math.max(1, fromCounts.get(relationship.fromNodeId) ?? relationship.count)),
      from_node_id: relationship.fromNodeId,
      id: `observed_${relationship.fromNodeId}_${relationship.toNodeId}_${relationship.type}`,
      mean_gap_ms: Math.round(relationship.gapTotal / Math.max(1, relationship.count)),
      required_zone_from: relationship.zoneFrom,
      required_zone_to: relationship.zoneTo,
      to_node_id: relationship.toNodeId,
      type: relationship.type,
    }))
    .sort((a, b) => b.confidence - a.confidence || a.mean_gap_ms - b.mean_gap_ms);

  return { nodes, relationships };
}

function classifyMovementNode(event: AxisEvent, nodes: MovementNode[]) {
  const candidates = nodes.filter((node) => node.event_types.includes(event.type));
  if (!candidates.length) return null;
  return candidates
    .map((node) => ({
      node,
      score: scoreNodeForEvent(node, event),
    }))
    .sort((a, b) => b.score - a.score)[0].node;
}

function scoreNodeForEvent(node: MovementNode, event: AxisEvent) {
  let score = 0;
  if (node.event_types.includes(event.type)) score += 4;
  if (node.typical_origin_zones.includes(event.zone)) score += 2;
  if (event.terminus && node.typical_terminus_zones.includes(classifyTerminusZone(event))) score += 2;
  const duration = event.ended_at - event.started_at;
  if (duration >= node.typical_duration_ms[0] && duration <= node.typical_duration_ms[1]) score += 1;
  return score;
}

function inferRelationshipType(fromEvent: AxisEvent, toEvent: AxisEvent): MovementRelationshipType {
  if (fromEvent.type === "drive" && (toEvent.type === "kick" || toEvent.type === "pass")) return "triggers";
  if ((fromEvent.type === "kick" || fromEvent.type === "pass") && toEvent.type === "closeout") return "triggers";
  if (fromEvent.type === "closeout" && toEvent.type === "drive") return "enables";
  if (fromEvent.type === "rotation" && (toEvent.type === "kick" || toEvent.type === "pass")) return "enables";
  return "precedes";
}

function cloneMovementNode(node: MovementNode): MovementNode {
  return {
    ...node,
    example_event_ids: [],
    occurrence_count: 0,
    tags: [...node.tags],
    typical_duration_ms: [...node.typical_duration_ms],
    typical_origin_zones: [...node.typical_origin_zones],
    typical_terminus_zones: [...node.typical_terminus_zones],
  };
}

function addUniqueZone(zones: AxisCourtZone[], zone: AxisCourtZone) {
  return zones.includes(zone) ? zones : [...zones, zone];
}

function mergeDurationRange(range: [number, number], durationMs: number): [number, number] {
  return [Math.min(range[0], durationMs), Math.max(range[1], durationMs)];
}

function classifyTerminusZone(event: AxisEvent): AxisCourtZone {
  if (!event.terminus) return event.zone;
  const { x, y } = event.terminus;
  if (y < 0 || y > 1 || x < 0 || x > 1) return "unknown";
  if (y > 0.85) return "backcourt";
  if (y > 0.65) return "transition";
  if (y < 0.42 && x > 0.32 && x < 0.68) return "paint";
  if (y < 0.28 && x < 0.15) return "corner_left";
  if (y < 0.28 && x > 0.85) return "corner_right";
  if (x < 0.22 && y < 0.55) return "wing_left";
  if (x > 0.78 && y < 0.55) return "wing_right";
  if (x > 0.35 && x < 0.65 && y > 0.35 && y < 0.58) return "top_key";
  if (x < 0.4) return "mid_range_left";
  if (x > 0.6) return "mid_range_right";
  return "mid_range_center";
}

function roundGraphNumber(value: number) {
  return Math.round(value * 1000) / 1000;
}
