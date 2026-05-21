export const NARRATIVE_SEED_FAMILIES = {
  SCORING_RUN: [
    "scoring_run_start",
    "scoring_run_acceleration",
    "scoring_run_interruption",
    "unanswered_run",
    "run_stabilized",
  ],
  PRESSURE: [
    "pressure_escalation",
    "pressure_release",
    "pressure_sustained",
    "pressure_break",
  ],
  COLLAPSE: [
    "turnover_collapse",
    "late_clock_fragmentation",
    "possession_breakdown",
    "defensive_breakdown",
  ],
  STABILIZATION: [
    "stabilization_recovery",
    "rebound_interruption",
    "timeout_response",
    "possession_reset",
  ],
  TRANSITION: [
    "transition_pressure",
    "transition_rebound_chain",
    "transition_score",
    "outlet_sequence",
  ],
  PLAYER_IMPACT: [
    "player_stabilized_flow",
    "player_triggered_run",
    "player_interrupted_pressure",
    "player_sequence",
  ],
  SPATIAL_FUTURE: [
    "containment_break",
    "wing_action_chain",
    "paint_pressure",
    "corner_creation",
  ],
  NEUTRAL_UNKNOWN: [
    "routine_possession",
    "low_signal_event",
    "unresolved_sequence",
  ],
} as const

export const NARRATIVE_SEEDS = [
  ...NARRATIVE_SEED_FAMILIES.SCORING_RUN,
  ...NARRATIVE_SEED_FAMILIES.PRESSURE,
  ...NARRATIVE_SEED_FAMILIES.COLLAPSE,
  ...NARRATIVE_SEED_FAMILIES.STABILIZATION,
  ...NARRATIVE_SEED_FAMILIES.TRANSITION,
  ...NARRATIVE_SEED_FAMILIES.PLAYER_IMPACT,
  ...NARRATIVE_SEED_FAMILIES.SPATIAL_FUTURE,
  ...NARRATIVE_SEED_FAMILIES.NEUTRAL_UNKNOWN,
] as const

export type NarrativeSeed = (typeof NARRATIVE_SEEDS)[number]

export const AXIS_NARRATIVE_SEEDS = NARRATIVE_SEEDS
export type AxisNarrativeSeed = NarrativeSeed

export function isNarrativeSeed(value: unknown): value is NarrativeSeed {
  return typeof value === "string" && NARRATIVE_SEEDS.includes(value as NarrativeSeed)
}

export function isAxisNarrativeSeed(value: unknown): value is AxisNarrativeSeed {
  return isNarrativeSeed(value)
}

export function assertNarrativeSeed(value: unknown): NarrativeSeed {
  if (isNarrativeSeed(value)) return value
  throw new Error(`Invalid narrativeSeed: ${String(value)}`)
}

export function assertNarrativeSeedList(values: unknown): NarrativeSeed[] {
  if (!Array.isArray(values)) {
    throw new Error("narrativeSeed list must be an array")
  }

  return values.map(assertNarrativeSeed)
}

export function narrativeSeedsFromTags(tags: string[]): NarrativeSeed[] {
  const normalized = new Set(tags.map((tag) => tag.toLowerCase()))
  const seeds = new Set<NarrativeSeed>()

  if (normalized.has("rebound") && normalized.has("transition")) seeds.add("transition_rebound_chain")
  if (normalized.has("rebound")) seeds.add("rebound_interruption")
  if (normalized.has("turnover")) seeds.add("turnover_collapse")
  if (normalized.has("stop") || normalized.has("pressure")) seeds.add("pressure_escalation")
  if (normalized.has("pressure_release")) seeds.add("pressure_release")
  if (normalized.has("pressure_sustained")) seeds.add("pressure_sustained")
  if (normalized.has("pressure_break")) seeds.add("pressure_break")
  if (normalized.has("stabilization") || normalized.has("recovery")) seeds.add("stabilization_recovery")
  if (normalized.has("reset")) seeds.add("possession_reset")
  if (normalized.has("late_clock")) seeds.add("late_clock_fragmentation")
  if (normalized.has("transition")) seeds.add("transition_pressure")
  if (normalized.has("outlet")) seeds.add("outlet_sequence")
  if (normalized.has("containment")) seeds.add("containment_break")
  if (normalized.has("paint")) seeds.add("paint_pressure")
  if (normalized.has("corner")) seeds.add("corner_creation")
  if (normalized.has("player")) seeds.add("player_sequence")
  if (normalized.has("unanswered") || normalized.has("run")) seeds.add("unanswered_run")
  if (normalized.has("routine")) seeds.add("routine_possession")

  if (!seeds.size) seeds.add(normalized.size ? "low_signal_event" : "unresolved_sequence")

  return Array.from(seeds)
}
