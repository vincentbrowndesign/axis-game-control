import { inferMovement } from "./movementInference"

export async function buildSequence() {
  const sequence = await inferMovement()

  return {
    timeline: sequence.map((item, index) => ({
      id: index,
      label: item,
      time: `0:0${index + 4}`
    }))
  }
}