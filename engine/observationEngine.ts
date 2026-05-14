import { AxisObservation } from "@/types/axis"

export function generateObservations(): AxisObservation[] {
  return [
    {
      id: crypto.randomUUID(),
      text: "Decision speed slowed late clock.",
      confidence: 82,
    },
    {
      id: crypto.randomUUID(),
      text: "Paint touches increased shot quality.",
      confidence: 91,
    },
    {
      id: crypto.randomUUID(),
      text: "Spacing collapsed after second-side action.",
      confidence: 76,
    },
  ]
}