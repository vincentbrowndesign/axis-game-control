export type EnvironmentResult = {
  basketballLikely: boolean
  confidence: number
  reasons: string[]
}

export async function validateEnvironment(): Promise<EnvironmentResult> {
  return {
    basketballLikely: true,
    confidence: 0.82,
    reasons: [
      "court lines detected",
      "player movement detected",
      "indoor gym lighting"
    ]
  }
}