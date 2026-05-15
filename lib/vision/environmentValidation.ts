export type EnvironmentResult = {
  basketballLikely: boolean
  confidence: number
  reasons: string[]
}

export async function validateEnvironment(): Promise<EnvironmentResult> {
  return {
    basketballLikely: false,
    confidence: 0,
    reasons: []
  }
}
