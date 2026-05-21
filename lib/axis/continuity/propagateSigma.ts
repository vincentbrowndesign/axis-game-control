import { clampSigma, directionalMultiplier, impedanceWeight } from "@/lib/axis/continuity/asymmetry"
import type {
  SigmaField,
  SigmaFieldEdge,
  SigmaFieldNode,
  SigmaPropagationMode,
  SigmaRawContributions,
} from "@/lib/axis/continuity/fieldTypes"

export function propagateSigma(field: SigmaField, direction: SigmaPropagationMode = "both"): SigmaField {
  assertPropagationInvariant(field, direction)

  const nodes = new Map(
    field.nodes.map((node) => [
      node.id,
      {
        ...node,
        rawContributions: {
          ...node.rawContributions,
        },
      },
    ]),
  )

  for (const edge of field.edges) {
    if (!shouldPropagateEdge(edge, direction)) continue

    const from = nodes.get(edge.fromId)
    const to = nodes.get(edge.toId)
    if (!from || !to) continue

    const contribution = calculateContribution(from, edge)
    to.sigma = clampSigma(to.sigma + contribution)
    to.rawContributions = addContribution(to.rawContributions, edge.direction, contribution)
  }

  return {
    ...field,
    lifecycle: "propagated",
    nodes: Array.from(nodes.values()),
    propagatedFrom: direction,
  }
}

function assertPropagationInvariant(field: SigmaField, direction: SigmaPropagationMode) {
  if (field.lifecycle !== "fresh") {
    throw new Error("Sigma propagation requires a fresh field. Rebuild the field before propagating again.")
  }

  if (direction === "both" && field.propagatedFrom !== null) {
    throw new Error("Both-direction sigma propagation is valid only on unmodified fresh fields.")
  }
}

function shouldPropagateEdge(edge: SigmaFieldEdge, direction: SigmaPropagationMode) {
  if (direction === "both") return true
  return edge.direction === direction || edge.direction === "lateral"
}

function calculateContribution(from: SigmaFieldNode, edge: SigmaFieldEdge) {
  return clampSigma(from.sigma * edge.weight * directionalMultiplier(edge.direction) * impedanceWeight(edge.impedance))
}

function addContribution(
  contributions: SigmaRawContributions,
  direction: SigmaFieldEdge["direction"],
  value: number,
): SigmaRawContributions {
  if (direction === "forward") {
    return {
      ...contributions,
      forward: contributions.forward + value,
    }
  }

  if (direction === "backward") {
    return {
      ...contributions,
      backward: contributions.backward + value,
    }
  }

  return {
    ...contributions,
    lateral: contributions.lateral + value,
  }
}
