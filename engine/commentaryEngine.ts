import { AxisState } from "./inferenceEngine"

export function buildCommentary(
  states: AxisState[]
) {
  const commentary: string[] = []

  if (states.includes("ADVANTAGE")) {
    commentary.push(
      "Advantage created."
    )
  }

  if (states.includes("HELP")) {
    commentary.push(
      "Help defender committed."
    )
  }

  if (states.includes("SHIFT")) {
    commentary.push(
      "Defense shifted."
    )
  }

  if (states.includes("COLLAPSE")) {
    commentary.push(
      "Defense collapsed into paint."
    )
  }

  if (states.includes("ROTATE")) {
    commentary.push(
      "Late rotation detected."
    )
  }

  return commentary
}