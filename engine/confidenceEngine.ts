export function confidenceLabel(score: number) {
  if (score >= 90) return "HIGH"
  if (score >= 75) return "MEDIUM"
  return "LOW"
}