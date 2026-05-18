export type SignalSide = "home" | "away"

export type RunSignal = {
  id: string
  side: SignalSide
  time: number
}

export function signalLabel(signal: RunSignal) {
  return signal.side.toUpperCase()
}
