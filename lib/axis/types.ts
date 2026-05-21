export type AxisMode = "memory" | "live" | "replay" | "inspect"

export type AxisTeam = "home" | "away"

export type AxisPlayerStatLine = {
  id: string
  label: string
  points: number
  rebounds: number
  assists: number
  turnovers: number
  fouls: number
}

export type AxisStaticOutputs = {
  score: {
    home: number
    away: number
  }
  possession: AxisTeam
  possessionCount: number
  eventCount: number
  players: AxisPlayerStatLine[]
}

export type AxisMemoryObject = {
  id: string
  label: string
  timestamp: string
  scoreState: string
  playerIds: string[]
  eventLabel: string
  replayAnchor: string | null
  tags: string[]
}

export type AxisContextualOutputs = {
  lastRun: string | null
  collapseWindow: string | null
  stabilizationMoment: string | null
  pressureShift: string | null
  playerSequence: string | null
  continuityChain: string[]
}

export type AxisIntelligenceOutput = {
  query: string
  answer: string
  supportingMemoryIds: string[]
  staticOutputs: AxisStaticOutputs
  contextualOutputs: AxisContextualOutputs
  memoryOutputs: AxisMemoryObject[]
}

export type AxisToolAvailability = {
  openai: boolean
  supabase: boolean
  mux: boolean
  mediapipe: boolean
  roboflow: boolean
  deepgram: boolean
}
