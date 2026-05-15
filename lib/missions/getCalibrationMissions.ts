import type { CalibrationMission } from "./types"

const MISSIONS: CalibrationMission[] = [
  {
    id: "calibration-01-handle",
    title: "CALIBRATION 01 - HANDLE",
    description: "Record 20 seconds of stationary dribbling.",
    durationTarget: 20,
    difficulty: "starter",
    signalFocus: [
      "bounce cadence",
      "hand movement rhythm",
      "camera stability",
      "audio repetition",
    ],
    uiState: "ready",
  },
  {
    id: "calibration-02-footwork",
    title: "CALIBRATION 02 - FOOTWORK",
    description: "Record 15 seconds of jab steps and pivots.",
    durationTarget: 15,
    difficulty: "focused",
    signalFocus: [
      "lateral motion",
      "lower-body movement",
      "directional changes",
    ],
    uiState: "ready",
  },
  {
    id: "calibration-03-shooting-form",
    title: "CALIBRATION 03 - SHOOTING FORM",
    description: "Record 10 jump shots from the same spot.",
    durationTarget: 45,
    difficulty: "focused",
    signalFocus: [
      "repeated release motion",
      "body silhouette repetition",
      "camera framing consistency",
    ],
    uiState: "ready",
  },
  {
    id: "calibration-04-live-movement",
    title: "CALIBRATION 04 - LIVE MOVEMENT",
    description: "Record 30 seconds of live play.",
    durationTarget: 30,
    difficulty: "live",
    signalFocus: [
      "motion chaos",
      "pace variation",
      "camera instability",
      "audio activity",
    ],
    uiState: "ready",
  },
  {
    id: "calibration-05-transition",
    title: "CALIBRATION 05 - TRANSITION",
    description: "Record a full-speed transition sequence.",
    durationTarget: 20,
    difficulty: "live",
    signalFocus: [
      "acceleration",
      "movement intensity",
      "rapid camera movement",
    ],
    uiState: "ready",
  },
]

export function getCalibrationMissions() {
  return MISSIONS.map((mission) => ({ ...mission }))
}
