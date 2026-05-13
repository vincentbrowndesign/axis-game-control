export function calculateMomentum(
  speed: number,
  spacing: number
) {
  return speed * 0.7 + spacing * 0.3
}