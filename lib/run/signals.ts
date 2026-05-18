export type SignalSide = "home" | "away"

export type SignalResult = "make" | "miss"

export type RunSignal = {
  id: string
  side: SignalSide
  result: SignalResult
  time: number
}

export function signalLabel(signal: RunSignal) {
  return `${signal.side.toUpperCase()} ${signal.result.toUpperCase()}`
}
