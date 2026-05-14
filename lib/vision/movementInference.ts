export type MovementSignal =
  | "BALL MOVE"
  | "DRIVE"
  | "PAINT TOUCH"
  | "OPEN"
  | "SHOT"

export async function inferMovement(): Promise<MovementSignal[]> {
  return [
    "BALL MOVE",
    "DRIVE",
    "PAINT TOUCH",
    "OPEN",
    "SHOT"
  ]
}