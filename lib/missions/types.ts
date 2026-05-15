export type CalibrationMissionDifficulty =
  | "starter"
  | "focused"
  | "live"

export type CalibrationSignalFocus =
  | "bounce cadence"
  | "hand movement rhythm"
  | "camera stability"
  | "audio repetition"
  | "lateral motion"
  | "lower-body movement"
  | "directional changes"
  | "repeated release motion"
  | "body silhouette repetition"
  | "camera framing consistency"
  | "motion chaos"
  | "pace variation"
  | "camera instability"
  | "audio activity"
  | "acceleration"
  | "movement intensity"
  | "rapid camera movement"

export type CalibrationMissionUiState =
  | "ready"
  | "selected"
  | "stored"

export type CalibrationMission = {
  id: string
  title: string
  description: string
  durationTarget: number
  difficulty: CalibrationMissionDifficulty
  signalFocus: CalibrationSignalFocus[]
  uiState: CalibrationMissionUiState
}
