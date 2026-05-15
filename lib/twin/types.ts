export type DigitalTwinRole = "player" | "trainer" | "coach"

export type DominantHand = "right" | "left" | "both"

export type CameraOrientation = "rear" | "front"

export type DigitalTwin = {
  id: string
  displayName: string
  dominantHand: DominantHand
  role: DigitalTwinRole
  cameraOrientation: CameraOrientation
  photo?: string | null
  grade?: string | null
  position?: string | null
  createdAt: number
  updatedAt: number
}

export type WarmupChainProgress = {
  twinId: string
  twinName: string
  warmupId: string
  completedCount: number
  unlockAfter: number
  sessionIds: string[]
  latestSessionId: string | null
  updatedAt: number
}
