export const AXIS_NARRATIVE_SEEDS = [
  "transition_rebound_chain",
  "pressure_escalation",
  "stabilization_recovery",
  "turnover_collapse",
  "late_clock_fragmentation",
  "transition_pressure",
  "containment_break",
  "rebound_interruption",
  "continuity_reversal",
] as const

export type AxisNarrativeSeed = (typeof AXIS_NARRATIVE_SEEDS)[number]

export function isAxisNarrativeSeed(value: string): value is AxisNarrativeSeed {
  return AXIS_NARRATIVE_SEEDS.includes(value as AxisNarrativeSeed)
}

export function narrativeSeedsFromTags(tags: string[]): AxisNarrativeSeed[] {
  const normalized = new Set(tags.map((tag) => tag.toLowerCase()))
  const seeds = new Set<AxisNarrativeSeed>()

  if (normalized.has("rebound") && normalized.has("transition")) seeds.add("transition_rebound_chain")
  if (normalized.has("rebound")) seeds.add("rebound_interruption")
  if (normalized.has("turnover")) seeds.add("turnover_collapse")
  if (normalized.has("stop") || normalized.has("pressure")) seeds.add("pressure_escalation")
  if (normalized.has("stabilization") || normalized.has("recovery")) seeds.add("stabilization_recovery")
  if (normalized.has("late_clock")) seeds.add("late_clock_fragmentation")
  if (normalized.has("transition")) seeds.add("transition_pressure")
  if (normalized.has("containment")) seeds.add("containment_break")
  if (normalized.has("reversal")) seeds.add("continuity_reversal")

  return Array.from(seeds)
}
