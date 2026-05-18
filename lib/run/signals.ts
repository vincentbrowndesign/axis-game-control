export type SignalSide = "home" | "away"

export type SignalResult = "plus" | "minus"

export type SignalPolarity = "PLUS" | "MINUS"

export type SignalStat =
  | "PTS"
  | "REB"
  | "AST"
  | "STL"
  | "BLK"
  | "TO"
  | "FOUL"
  | "MISS"

export type RunSignal = {
  id: string
  side: SignalSide
  result: SignalResult
  polarity: SignalPolarity
  stat: SignalStat
  playerId?: string
  time: number
}

const positiveSignals = new Set<SignalResult>(["plus"])

const negativeSignals = new Set<SignalResult>(["minus"])

export function normalizeSignalResult(value: unknown): SignalResult {
  if (
    value === "minus" ||
    value === "miss" ||
    value === "turnover" ||
    value === "foul"
  ) {
    return "minus"
  }

  return "plus"
}

export function polarityForResult(result: SignalResult): SignalPolarity {
  return result === "plus" ? "PLUS" : "MINUS"
}

export function normalizeSignalStat(
  value: unknown,
  result: SignalResult
): SignalStat {
  if (
    value === "PTS" ||
    value === "REB" ||
    value === "AST" ||
    value === "STL" ||
    value === "BLK" ||
    value === "TO" ||
    value === "FOUL" ||
    value === "MISS"
  ) {
    return value
  }

  return result === "plus" ? "PTS" : "MISS"
}

export function isPositiveSignal(result: SignalResult) {
  return positiveSignals.has(result)
}

export function isNegativeSignal(result: SignalResult) {
  return negativeSignals.has(result)
}

export function signalDisplay(result: SignalResult) {
  return result === "plus" ? "+" : "-"
}

export function signalEventLabel(signal: RunSignal) {
  return `${signalDisplay(signal.result)} ${signal.stat}`
}

export function signalLabel(signal: RunSignal) {
  return `${signal.side.toUpperCase()} ${signalEventLabel(signal)}`
}
