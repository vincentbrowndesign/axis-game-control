import { AxisObservation } from "@/types/axis"

type MemorySession = {
  sessionId: string
  playerId: string
  observations: AxisObservation[]
  createdAt: string
}

const memoryStore: MemorySession[] = []

export function saveMemorySession(session: MemorySession) {
  memoryStore.push(session)
}

export function getPlayerMemory(playerId: string) {
  return memoryStore.filter((s) => s.playerId === playerId)
}