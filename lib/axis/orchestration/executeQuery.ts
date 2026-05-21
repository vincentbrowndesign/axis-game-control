import { buildAxisContextPackage, type AxisContextPackageInput } from "@/lib/axis/contextPackage"
import { createStrategicPlan } from "@/lib/axis/orchestration/planner"
import { routeProvider } from "@/lib/axis/orchestration/router"
import { buildRuntimeContext, createRuntimeResult, type AxisRuntimeResult } from "@/lib/axis/orchestration/runtime"
import { validateRuntimeResult } from "@/lib/axis/runtime/runtimeValidation"

export async function executeQuery(request: AxisContextPackageInput): Promise<AxisRuntimeResult> {
  const startedAt = Date.now()
  const context = buildAxisContextPackage(request)
  const plan = createStrategicPlan(request.query, context)
  const runtimeContext = buildRuntimeContext(context, plan)
  const routed = await routeProvider({
    query: request.query,
    context,
    plan,
  })

  const result = createRuntimeResult({
    query: request.query,
    context,
    runtimeContext,
    output: routed.output,
    providerPath: routed.providerPath,
    confidence: routed.confidence,
    provenance: routed.provenance,
    startedAt,
  })
  const validation = validateRuntimeResult(result)

  if (!validation.valid) {
    return {
      ...result,
      receipt: {
        ...result.receipt,
        confidence: Math.min(result.receipt.confidence, 0.52),
      },
    }
  }

  return result
}
