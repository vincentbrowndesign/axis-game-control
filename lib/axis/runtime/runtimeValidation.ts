import type { AxisRuntimeReceipt } from "@/lib/axis/runtime/runtimeReceipts"
import type { AxisRuntimeResult } from "@/lib/axis/orchestration/runtime"

export type AxisRuntimeValidationResult = {
  valid: boolean
  checks: {
    deterministicRetrieval: boolean
    providerRouting: boolean
    provenance: boolean
    sigmaIntegrity: boolean
    narrativeSeedStability: boolean
    continuityGrounding: boolean
  }
}

export function validateRuntimeResult(result: AxisRuntimeResult): AxisRuntimeValidationResult {
  const receipt = result.receipt
  const checks = {
    deterministicRetrieval: receipt.retrievalPath.memoryIds.every((id) =>
      result.output.supportingMemoryIds.includes(id),
    ),
    providerRouting: receipt.providerPath.length > 0,
    provenance: Boolean(receipt.synthesisProvenance && receipt.runtimeLatencyMs >= 0),
    sigmaIntegrity: Boolean(receipt.continuityReceipt.sigmaPackagePresent && receipt.sigmaLineage.rankedMemoryIds.length),
    narrativeSeedStability: receipt.sigmaLineage.narrativeSeeds.every((seed) =>
      result.runtimeContext.sigmaMemoryPackage?.narrativeSeeds.includes(seed),
    ),
    continuityGrounding:
      result.output.supportingMemoryIds.length > 0 || result.runtimeContext.recentMemory.lastEvents.length === 0,
  }

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
  }
}

export function validateRuntimeReceipt(receipt: AxisRuntimeReceipt) {
  return Boolean(receipt.query && receipt.providerPath.length && receipt.confidence >= 0 && receipt.confidence <= 1)
}
