export function confidenceScore(
  confidence: number
) {
  if (confidence >= 0.85) {
    return "HIGH"
  }

  if (confidence >= 0.65) {
    return "MEDIUM"
  }

  return "LOW"
}