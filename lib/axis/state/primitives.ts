export const AXIS_IMPLEMENTED_PRIMITIVES = [
  "sto",
  "event_sourcing",
  "chronology_rebuild",
  "rewind_transition",
  "replay_chronology",
  "memory_graph",
  "context_package",
  "query_classification",
  "retrieval",
  "continuity_relationships",
  "static_analytics",
  "contextual_analytics",
  "persistent_shell",
  "state_viewport",
  "contextual_overlays",
] as const

export type AxisImplementedPrimitive = (typeof AXIS_IMPLEMENTED_PRIMITIVES)[number]

export const AXIS_RESEARCH_METAPHORS = [
  "resonance_field",
  "continuity_manifold",
  "tensor_bundle",
  "activation_gradient",
  "neural_ode",
  "hamiltonian_system",
  "world_state_tensor",
] as const

export type AxisResearchMetaphor = (typeof AXIS_RESEARCH_METAPHORS)[number]

export type AxisPrimitiveBoundary = {
  implemented: AxisImplementedPrimitive[]
  researchOnly: AxisResearchMetaphor[]
}

export const AXIS_PRIMITIVE_BOUNDARY: AxisPrimitiveBoundary = {
  implemented: [...AXIS_IMPLEMENTED_PRIMITIVES],
  researchOnly: [...AXIS_RESEARCH_METAPHORS],
}

export function isImplementedPrimitive(value: string): value is AxisImplementedPrimitive {
  return AXIS_IMPLEMENTED_PRIMITIVES.includes(value as AxisImplementedPrimitive)
}
