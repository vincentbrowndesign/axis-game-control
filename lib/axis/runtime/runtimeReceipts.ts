import type { NarrativeSeed } from "@/lib/axis/continuity/narrativeSeeds"

export type AxisProviderName = "openai" | "deepseek" | "perplexity" | "axis_local"

export type AxisRetrievalPath = {
  source: "chronology" | "memory_snapshot"
  depth: "shallow" | "standard" | "deep"
  memoryIds: string[]
  narrativeSeeds: NarrativeSeed[]
}

export type AxisRuntimeReceipt = {
  id: string
  query: string
  providerPath: AxisProviderName[]
  retrievalPath: AxisRetrievalPath
  continuityReceipt: {
    kernelSource: "chronology" | "memory_snapshot"
    sigmaPackagePresent: boolean
    continuityReferences: string[]
  }
  sigmaLineage: {
    rankedMemoryIds: string[]
    clusterIds: string[]
    narrativeSeeds: NarrativeSeed[]
  }
  runtimeLatencyMs: number
  confidence: number
  synthesisProvenance: "provider" | "local_axis" | "fallback"
  createdAt: string
}

export function createRuntimeReceipt(input: Omit<AxisRuntimeReceipt, "id" | "createdAt">): AxisRuntimeReceipt {
  return {
    ...input,
    id: `receipt-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  }
}
