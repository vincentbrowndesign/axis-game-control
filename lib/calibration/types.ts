export type CalibrationStatus =
  | "BASELINE STARTED"
  | "MEMORY ADDED"
  | "NOT ENOUGH MEMORY"
  | "COMPARISON LOCKED"

export type CalibrationBaseline = {
  status: CalibrationStatus
  averageSessionDuration: number
  averageMotionIntensity: number | null
  averageAudioEnergy: number | null
  usualSource: "upload" | "camera"
  memoryCount: number
  firstMemoryDate: number | null
  latestMemoryDate: number | null
  missionType: string | null
  missionCompletionCount: number
  missionSessions: CalibrationMissionSession[]
}

export type CalibrationMissionSession = {
  missionType: string
  duration: number
  motionLevel: number | null
  audioLevel: number | null
  completionCount: number
  timestamp: number
}
