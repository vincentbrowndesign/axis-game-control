import { createOpenAIAdapter } from "@/lib/axis/adapters/openai"
import type { AxisContextPackage } from "@/lib/axis/contextPackage"
import { synthesizeRuntimeOutput } from "@/lib/axis/orchestration/runtime"
import type { AxisStrategicPlan } from "@/lib/axis/orchestration/planner"
import type { AxisProviderName } from "@/lib/axis/runtime/runtimeReceipts"
import type { AxisIntelligenceOutput } from "@/lib/axis/types"

export type AxisProviderRouteResult = {
  output: AxisIntelligenceOutput
  providerPath: AxisProviderName[]
  provenance: "provider" | "local_axis" | "fallback"
  confidence: number
}

export async function routeProvider({
  query,
  context,
  plan,
}: {
  query: string
  context: AxisContextPackage
  plan: AxisStrategicPlan
}): Promise<AxisProviderRouteResult> {
  if (plan.provider === "openai") {
    const openai = createOpenAIAdapter()
    if (openai.available) {
      const output = await withTimeout(
        openai.complete({
          query,
          contextPackage: context,
        }),
        2400,
      )

      if (output) {
        return {
          output,
          providerPath: ["openai"],
          provenance: "provider",
          confidence: 0.82,
        }
      }
    }
  }

  const output = synthesizeRuntimeOutput(query, context, plan)
  return {
    output,
    providerPath: plan.provider === "openai" ? ["openai", "axis_local"] : [plan.provider, "axis_local"],
    provenance: plan.provider === "openai" ? "fallback" : "local_axis",
    confidence: plan.provider === "perplexity" && plan.requiresExternalSearch ? 0.48 : 0.74,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<null>((resolve) => {
    timeout = setTimeout(() => resolve(null), timeoutMs)
  })

  const result = await Promise.race([promise, timeoutPromise])
  if (timeout) clearTimeout(timeout)
  return result
}
