import type {
  Landmark,
  LandmarkType,
  MissionPoseObservation,
  PoseFrame,
  PoseLandmarkRead,
  PoseObservationState,
} from "./types"

const LANDMARK_TYPES: LandmarkType[] = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
]

type MediaPipeLandmark = {
  x: number
  y: number
  z?: number
  visibility?: number
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

function average(values: number[]) {
  if (!values.length) return null

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function distance(a?: Landmark, b?: Landmark) {
  if (!a || !b) return null

  return Math.hypot(a.x - b.x, a.y - b.y)
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0

  const mean = average(values) || 0
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length

  return Math.sqrt(variance)
}

function landmark(frame: PoseFrame, type: LandmarkType) {
  return frame.landmarks.find((item) => item.type === type)
}

function movement(
  frames: PoseFrame[],
  types: LandmarkType[]
) {
  const values: number[] = []

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const distances = types
      .map((type) => distance(landmark(previous, type), landmark(current, type)))
      .filter((value): value is number => value != null)

    if (distances.length) {
      values.push(average(distances) || 0)
    }
  }

  return average(values)
}

function consistencyFromValues(values: number[]) {
  if (values.length < 3) return null

  const mean = average(values) || 0

  if (mean <= 0) return null

  return clamp01(1 - standardDeviation(values) / mean)
}

function repeatedState(value: number | null): PoseObservationState {
  if (value == null) return "Waiting"
  if (value >= 0.68) return "Repeated"
  if (value >= 0.42) return "Active"

  return "Uneven"
}

function stableState(value: number | null): PoseObservationState {
  if (value == null) return "Waiting"
  if (value >= 0.72) return "Stable"
  if (value >= 0.48) return "Consistent"

  return "Interrupted"
}

function percent(value: number | null) {
  if (value == null) return "Waiting"

  return `${Math.round(clamp01(value) * 100)}%`
}

function observation(
  label: string,
  state: PoseObservationState,
  confidence: number,
  evidence: string
): MissionPoseObservation {
  return {
    label,
    state,
    confidence: clamp01(confidence),
    evidence,
  }
}

function visibilityConfidence(frames: PoseFrame[]) {
  const values = frames.map((frame) => frame.confidence)

  return average(values) || 0
}

function persistence(frames: PoseFrame[]) {
  if (!frames.length) return 0

  return (
    frames.filter((frame) => frame.confidence >= 0.45).length / frames.length
  )
}

function handleObservations(frames: PoseFrame[]) {
  const wristMovement = movement(frames, ["left_wrist", "right_wrist"])
  const shoulderMovement = movement(frames, [
    "left_shoulder",
    "right_shoulder",
  ])
  const stanceValues = frames
    .map((frame) =>
      distance(landmark(frame, "left_ankle"), landmark(frame, "right_ankle"))
    )
    .filter((value): value is number => value != null)
  const stanceConsistency = consistencyFromValues(stanceValues)
  const shoulderStability =
    shoulderMovement == null ? null : clamp01(1 - shoulderMovement * 8)
  const wristRhythm =
    wristMovement == null ? null : clamp01(Math.min(1, wristMovement * 8))

  return [
    observation(
      "Wrist Rhythm",
      repeatedState(wristRhythm),
      wristRhythm || 0,
      `${percent(wristRhythm)} wrist movement`
    ),
    observation(
      "Stance Width",
      stableState(stanceConsistency),
      stanceConsistency || 0,
      `${percent(stanceConsistency)} consistent`
    ),
    observation(
      "Shoulder Stability",
      stableState(shoulderStability),
      shoulderStability || 0,
      `${percent(shoulderStability)} stable`
    ),
  ]
}

function footworkObservations(frames: PoseFrame[]) {
  const hipMovement = movement(frames, ["left_hip", "right_hip"])
  const kneeMovement = movement(frames, ["left_knee", "right_knee"])
  const ankleMovement = movement(frames, ["left_ankle", "right_ankle"])

  return [
    observation(
      "Lateral Movement",
      repeatedState(hipMovement == null ? null : clamp01(hipMovement * 8)),
      hipMovement == null ? 0 : clamp01(hipMovement * 8),
      `${percent(hipMovement == null ? null : clamp01(hipMovement * 8))} hip movement`
    ),
    observation(
      "Balance Shift",
      repeatedState(kneeMovement == null ? null : clamp01(kneeMovement * 8)),
      kneeMovement == null ? 0 : clamp01(kneeMovement * 8),
      `${percent(kneeMovement == null ? null : clamp01(kneeMovement * 8))} knee movement`
    ),
    observation(
      "Stance Transition",
      repeatedState(ankleMovement == null ? null : clamp01(ankleMovement * 8)),
      ankleMovement == null ? 0 : clamp01(ankleMovement * 8),
      `${percent(ankleMovement == null ? null : clamp01(ankleMovement * 8))} foot movement`
    ),
  ]
}

function shootingObservations(frames: PoseFrame[]) {
  const elbowValues = frames
    .map((frame) => {
      const shoulder = landmark(frame, "right_shoulder")
      const elbow = landmark(frame, "right_elbow")
      const wrist = landmark(frame, "right_wrist")
      const upper = distance(shoulder, elbow)
      const lower = distance(elbow, wrist)

      return upper == null || lower == null ? null : upper + lower
    })
    .filter((value): value is number => value != null)
  const elbowConsistency = consistencyFromValues(elbowValues)
  const shoulderValues = frames
    .map((frame) =>
      distance(landmark(frame, "left_shoulder"), landmark(frame, "right_shoulder"))
    )
    .filter((value): value is number => value != null)
  const shoulderConsistency = consistencyFromValues(shoulderValues)
  const upperMovement = movement(frames, [
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
  ])
  const upperRhythm =
    upperMovement == null ? null : clamp01(Math.min(1, upperMovement * 6))

  return [
    observation(
      "Release Path",
      stableState(elbowConsistency),
      elbowConsistency || 0,
      `${percent(elbowConsistency)} consistent`
    ),
    observation(
      "Shoulder Alignment",
      stableState(shoulderConsistency),
      shoulderConsistency || 0,
      `${percent(shoulderConsistency)} aligned`
    ),
    observation(
      "Upper Body Rhythm",
      repeatedState(upperRhythm),
      upperRhythm || 0,
      `${percent(upperRhythm)} repeated`
    ),
  ]
}

function liveMovementObservations(frames: PoseFrame[]) {
  const bodyMovement = movement(frames, [
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
  ])
  const footMovement = movement(frames, ["left_ankle", "right_ankle"])
  const persistenceScore = persistence(frames)

  return [
    observation(
      "Body Velocity",
      repeatedState(bodyMovement == null ? null : clamp01(bodyMovement * 8)),
      bodyMovement == null ? 0 : clamp01(bodyMovement * 8),
      `${percent(bodyMovement == null ? null : clamp01(bodyMovement * 8))} body movement`
    ),
    observation(
      "Directional Shift",
      repeatedState(footMovement == null ? null : clamp01(footMovement * 8)),
      footMovement == null ? 0 : clamp01(footMovement * 8),
      `${percent(footMovement == null ? null : clamp01(footMovement * 8))} foot movement`
    ),
    observation(
      "Landmark Persistence",
      stableState(persistenceScore),
      persistenceScore,
      `${percent(persistenceScore)} persistent`
    ),
  ]
}

function transitionObservations(frames: PoseFrame[]) {
  const hipMovement = movement(frames, ["left_hip", "right_hip"])
  const strideValues = frames
    .map((frame) =>
      distance(landmark(frame, "left_ankle"), landmark(frame, "right_ankle"))
    )
    .filter((value): value is number => value != null)
  const strideConsistency = consistencyFromValues(strideValues)
  const footMovement = movement(frames, ["left_ankle", "right_ankle"])

  return [
    observation(
      "Acceleration Window",
      repeatedState(hipMovement == null ? null : clamp01(hipMovement * 10)),
      hipMovement == null ? 0 : clamp01(hipMovement * 10),
      `${percent(hipMovement == null ? null : clamp01(hipMovement * 10))} hip movement`
    ),
    observation(
      "Stride Extension",
      stableState(strideConsistency),
      strideConsistency || 0,
      `${percent(strideConsistency)} consistent`
    ),
    observation(
      "Movement Burst",
      repeatedState(footMovement == null ? null : clamp01(footMovement * 10)),
      footMovement == null ? 0 : clamp01(footMovement * 10),
      `${percent(footMovement == null ? null : clamp01(footMovement * 10))} foot movement`
    ),
  ]
}

export function extractPoseFrame({
  timestamp,
  landmarks,
}: {
  timestamp: number
  landmarks: MediaPipeLandmark[]
}): PoseFrame | null {
  if (!landmarks.length) return null

  const normalized: Landmark[] = landmarks
    .slice(0, LANDMARK_TYPES.length)
    .map((item, index) => ({
      x: item.x,
      y: item.y,
      z: item.z ?? 0,
      visibility: item.visibility ?? 0,
      type: LANDMARK_TYPES[index],
    }))
  const confidence = average(normalized.map((item) => item.visibility)) || 0

  return {
    timestamp,
    landmarks: normalized,
    confidence,
  }
}

export function summarizePoseLandmarks({
  missionId,
  frames,
}: {
  missionId: string
  frames: PoseFrame[]
}): PoseLandmarkRead {
  if (!frames.length) {
    return {
      status: "unavailable",
      provider: "mediapipePoseProvider",
      frameCount: 0,
      confidence: 0,
      persistence: 0,
      observations: [],
      summary: "Landmark signal unavailable. Replay remains available.",
    }
  }

  const framePersistence = persistence(frames)
  const confidence = visibilityConfidence(frames)
  const mission = missionId.toUpperCase()
  const observations = mission.includes("HANDLE")
    ? handleObservations(frames)
    : mission.includes("FOOTWORK")
      ? footworkObservations(frames)
      : mission.includes("SHOOTING")
        ? shootingObservations(frames)
        : mission.includes("TRANSITION")
          ? transitionObservations(frames)
          : liveMovementObservations(frames)

  return {
    status: confidence >= 0.35 ? "available" : "unavailable",
    provider: "mediapipePoseProvider",
    frameCount: frames.length,
    confidence,
    persistence: framePersistence,
    observations,
    summary:
      confidence >= 0.35
        ? "Landmark signal recorded."
        : "Landmark signal unavailable. Replay remains available.",
  }
}
