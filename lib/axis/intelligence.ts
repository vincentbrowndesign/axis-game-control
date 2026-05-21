import { buildAxisContextPackage, extractAxisIntelligence, type AxisContextPackageInput } from "@/lib/axis/contextPackage"
import { createDeepgramAdapter } from "@/lib/axis/adapters/deepgram"
import { createMediaPipeAdapter } from "@/lib/axis/adapters/mediapipe"
import { createMuxAdapter } from "@/lib/axis/adapters/mux"
import { createOpenAIAdapter } from "@/lib/axis/adapters/openai"
import { createRoboflowAdapter } from "@/lib/axis/adapters/roboflow"
import { createSupabaseAdapter } from "@/lib/axis/adapters/supabase"
import type { AxisIntelligenceOutput, AxisToolAvailability } from "@/lib/axis/types"

export type AxisIntelligenceRequest = AxisContextPackageInput

export type AxisIntelligenceResponse = AxisIntelligenceOutput & {
  tools: AxisToolAvailability
}

export async function runAxisIntelligence(request: AxisIntelligenceRequest): Promise<AxisIntelligenceResponse> {
  const contextPackage = buildAxisContextPackage(request)
  const openai = createOpenAIAdapter()
  const supabase = createSupabaseAdapter()
  const mux = createMuxAdapter()
  const mediapipe = createMediaPipeAdapter()
  const roboflow = createRoboflowAdapter()
  const deepgram = createDeepgramAdapter()

  const modelOutput = openai.available
    ? await openai.complete({
        query: request.query,
        contextPackage,
      })
    : null

  const localOutput = modelOutput ?? extractAxisIntelligence(request.query, contextPackage)

  return {
    ...localOutput,
    tools: {
      openai: openai.available,
      supabase: supabase.available,
      mux: mux.available,
      mediapipe: mediapipe.available,
      roboflow: roboflow.available,
      deepgram: deepgram.available,
    },
  }
}
