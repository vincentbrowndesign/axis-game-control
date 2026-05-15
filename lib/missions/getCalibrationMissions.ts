import type { CalibrationMission } from "./types"

const MISSIONS: CalibrationMission[] = [
  {
    id: "calibration-01-handle",
    order: 1,
    title: "HANDLE",
    task: "Stationary dribbling",
    description: "Record 20 seconds of stationary dribbling.",
    durationTarget: 20,
    difficulty: "starter",
    axisWatches: [
      "bounce rhythm",
      "hand rhythm",
      "camera stability",
    ],
    baselineName: "Handle Rhythm",
    unlockAfter: 3,
    uiState: "ready",
  },
  {
    id: "calibration-02-footwork",
    order: 2,
    title: "FOOTWORK",
    task: "Jab steps and pivots",
    description: "Record 15 seconds of jab steps and pivots.",
    durationTarget: 15,
    difficulty: "focused",
    axisWatches: [
      "direction changes",
      "lower-body rhythm",
      "balance shifts",
    ],
    baselineName: "Footwork Rhythm",
    unlockAfter: 3,
    uiState: "ready",
  },
  {
    id: "calibration-03-shooting-form",
    order: 3,
    title: "SHOOTING FORM",
    task: "10 jump shots from the same spot",
    description: "Record 10 jump shots from the same spot.",
    durationTarget: 45,
    difficulty: "focused",
    axisWatches: [
      "release repeat",
      "body shape",
      "camera framing",
    ],
    baselineName: "Shot Form Rhythm",
    unlockAfter: 3,
    uiState: "ready",
  },
  {
    id: "calibration-04-live-movement",
    order: 4,
    title: "LIVE MOVEMENT",
    task: "Live play",
    description: "Record 30 seconds of live play.",
    durationTarget: 30,
    difficulty: "live",
    axisWatches: [
      "pace changes",
      "movement density",
      "live rhythm",
    ],
    baselineName: "Live Movement Rhythm",
    unlockAfter: 3,
    uiState: "ready",
  },
  {
    id: "calibration-05-transition",
    order: 5,
    title: "TRANSITION",
    task: "Full-speed transition sequence",
    description: "Record one full-speed transition sequence.",
    durationTarget: 20,
    difficulty: "live",
    axisWatches: [
      "acceleration",
      "movement intensity",
      "camera movement",
    ],
    baselineName: "Transition Rhythm",
    unlockAfter: 3,
    uiState: "ready",
  },
]

export function getCalibrationMissions() {
  return MISSIONS.map((mission) => ({ ...mission }))
}
