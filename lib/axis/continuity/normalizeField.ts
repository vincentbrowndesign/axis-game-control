import { clampSigma, MIN_ANCHOR_SIGMA } from "@/lib/axis/continuity/asymmetry"
import type {
  SigmaContinuityCluster,
  SigmaDirectionBias,
  SigmaField,
  SigmaMemoryPackage,
  SigmaRawContributions,
} from "@/lib/axis/continuity/fieldTypes"
import type { NarrativeSeed } from "@/lib/axis/continuity/narrativeSeeds"

export function normalizeField(field: SigmaField): SigmaMemoryPackage {
  if (field.lifecycle === "normalized") {
    throw new Error("Sigma field is already normalized. Rebuild the field before normalizing again.")
  }

  const anchored = preserveAnchorGrounding(field)
  const hierarchy = preserveSigmaHierarchy(anchored)
  const stabilized = preventEntropyInflation(hierarchy)
  const clusters = buildClusters(stabilized)
  const seeds = uniqueSeeds(stabilized.flatMap((node) => node.narrativeSeeds))
  field.lifecycle = "normalized"
  field.normalizedAt = new Date().toISOString()

  return {
    source: "sigma_memory_package",
    generatedAt: field.normalizedAt,
    anchors: stabilized
      .filter((node) => node.anchor)
      .map((node) => ({
        memoryId: node.id,
        sigma: node.sigma,
        narrativeSeeds: node.narrativeSeeds,
      })),
    rankedMemoryIds: [...stabilized].sort((a, b) => b.sigma - a.sigma).map((node) => node.id),
    clusters,
    narrativeSeeds: seeds,
  }
}

function preserveAnchorGrounding(field: SigmaField) {
  return field.nodes.map((node) => ({
    ...node,
    sigma: node.anchor ? Math.max(MIN_ANCHOR_SIGMA, node.sigma) : node.sigma,
  }))
}

function preserveSigmaHierarchy(nodes: ReturnType<typeof preserveAnchorGrounding>) {
  const max = Math.max(...nodes.map((node) => node.sigma), MIN_ANCHOR_SIGMA)
  return nodes.map((node) => ({
    ...node,
    sigma: clampSigma(node.sigma / max),
  }))
}

function preventEntropyInflation(nodes: ReturnType<typeof preserveAnchorGrounding>) {
  const anchorCount = Math.max(1, nodes.filter((node) => node.anchor).length)
  const total = nodes.reduce((sum, node) => sum + node.sigma, 0)
  const ceiling = Math.max(anchorCount * 1.4, 1)
  const scale = total > ceiling ? ceiling / total : 1

  return nodes.map((node) => ({
    ...node,
    sigma: node.anchor ? Math.max(MIN_ANCHOR_SIGMA, clampSigma(node.sigma * scale)) : clampSigma(node.sigma * scale),
  }))
}

function buildClusters(nodes: ReturnType<typeof preventEntropyInflation>): SigmaContinuityCluster[] {
  const clustered = new Map<NarrativeSeed, typeof nodes>()

  for (const node of nodes) {
    for (const seed of node.narrativeSeeds) {
      clustered.set(seed, [...(clustered.get(seed) ?? []), node])
    }
  }

  return Array.from(clustered.entries()).map(([seed, members]) => {
    const rawContributions = members.reduce<SigmaRawContributions>(
      (sum, node) => ({
        forward: sum.forward + node.rawContributions.forward,
        backward: sum.backward + node.rawContributions.backward,
        lateral: sum.lateral + node.rawContributions.lateral,
      }),
      {
        forward: 0,
        backward: 0,
        lateral: 0,
      },
    )

    return {
      id: `cluster-${seed}`,
      memoryIds: members.map((node) => node.id),
      sigma: clampSigma(members.reduce((sum, node) => sum + node.sigma, 0) / Math.max(1, members.length)),
      narrativeSeeds: [seed],
      rawContributions,
      directionBias: directionBiasFromContributions(rawContributions),
    }
  })
}

export function directionBiasFromContributions(contributions: SigmaRawContributions): SigmaDirectionBias {
  const total = contributions.forward + contributions.backward + contributions.lateral
  if (total <= 0) return "balanced"

  const forwardRatio = contributions.forward / total
  const backwardRatio = contributions.backward / total

  if (forwardRatio >= 0.55) return "forward"
  if (backwardRatio >= 0.55) return "backward"
  return "balanced"
}

function uniqueSeeds(seeds: NarrativeSeed[]) {
  return Array.from(new Set(seeds))
}
