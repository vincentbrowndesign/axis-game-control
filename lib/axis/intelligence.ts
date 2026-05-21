import type { AxisContextPackageInput } from "@/lib/axis/contextPackage"
import { createDeepgramAdapter } from "@/lib/axis/adapters/deepgram"
import { createMediaPipeAdapter } from "@/lib/axis/adapters/mediapipe"
import { createMuxAdapter } from "@/lib/axis/adapters/mux"
import { createRoboflowAdapter } from "@/lib/axis/adapters/roboflow"
import { createSupabaseAdapter } from "@/lib/axis/adapters/supabase"
import { executeQuery } from "@/lib/axis/orchestration/executeQuery"
import type { AxisRuntimeReceipt } from "@/lib/axis/runtime/runtimeReceipts"
import type { AxisIntelligenceOutput, AxisToolAvailability } from "@/lib/axis/types"

export type AxisIntelligenceRequest = AxisContextPackageInput

export type AxisIntelligenceResponse = AxisIntelligenceOutput & {
  tools: AxisToolAvailability
  runtimeReceipt?: AxisRuntimeReceipt
}

export async function runAxisIntelligence(request: AxisIntelligenceRequest): Promise<AxisIntelligenceResponse> {
  const supabase = createSupabaseAdapter()
  const mux = createMuxAdapter()
  const mediapipe = createMediaPipeAdapter()
  const roboflow = createRoboflowAdapter()
  const deepgram = createDeepgramAdapter()
  const result = await executeQuery(request)

  return {
    ...result.output,
    runtimeReceipt: result.receipt,
    tools: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      supabase: supabase.available,
      mux: mux.available,
      mediapipe: mediapipe.available,
      roboflow: roboflow.available,
      deepgram: deepgram.available,
    },
  }
}
