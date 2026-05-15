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
}
