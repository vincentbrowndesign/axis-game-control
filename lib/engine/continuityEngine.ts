import type { RunSignal } from "@/lib/run/signals"

export function continuityMultiplier(signals: RunSignal[], index: number) {
  const signal = signals[index]
  if (!signal) return 1

  let positiveRun = 0
  let negativeRun = 0

  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const current = signals[cursor]
    if (current.side !== signal.side || current.result !== signal.result) break
    if (current.result === "make") positiveRun += 1
    else negativeRun += 1
  }

  if (signal.result === "miss") return 1 + Math.min(negativeRun - 1, 3) * 0.16
  if (positiveRun >= 4) return 1.5
  if (positiveRun === 3) return 1.3
  if (positiveRun === 2) return 1.15

  return 1
}

