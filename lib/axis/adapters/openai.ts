import type { AxisContextPackage } from "@/lib/axis/contextPackage"
import type { AxisIntelligenceOutput } from "@/lib/axis/types"

export type AxisOpenAIRequest = {
  query: string
  contextPackage: AxisContextPackage
}

export type AxisOpenAIAdapter = {
  available: boolean
  complete: (request: AxisOpenAIRequest) => Promise<AxisIntelligenceOutput | null>
}

export function createOpenAIAdapter(): AxisOpenAIAdapter {
  return {
    available: Boolean(process.env.OPENAI_API_KEY),
    async complete() {
      return null
    },
  }
}
