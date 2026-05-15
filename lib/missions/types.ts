export type CalibrationMissionDifficulty =
  | "starter"
  | "focused"
  | "live"

export type CalibrationSignalFocus =
  | "bounce rhythm"
  | "hand rhythm"
  | "camera stability"
  | "direction changes"
  | "lower-body rhythm"
  | "balance shifts"
  | "release repeat"
  | "body shape"
  | "camera framing"
  | "pace changes"
  | "movement density"
  | "live rhythm"
  | "acceleration"
  | "movement intensity"
  | "camera movement"

export type CalibrationMissionUiState =
  | "ready"
  | "selected"
  | "stored"

export type CalibrationMission = {
  id: string
  order: number
  title: string
  task: string
  description: string
  durationTarget: number
  difficulty: CalibrationMissionDifficulty
  axisWatches: CalibrationSignalFocus[]
  baselineName: string
  unlockAfter: number
  uiState: CalibrationMissionUiState
}
