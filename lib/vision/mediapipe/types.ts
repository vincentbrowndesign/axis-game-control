export type LandmarkType =
  | "nose"
  | "left_eye_inner"
  | "left_eye"
  | "left_eye_outer"
  | "right_eye_inner"
  | "right_eye"
  | "right_eye_outer"
  | "left_ear"
  | "right_ear"
  | "mouth_left"
  | "mouth_right"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_pinky"
  | "right_pinky"
  | "left_index"
  | "right_index"
  | "left_thumb"
  | "right_thumb"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle"
  | "left_heel"
  | "right_heel"
  | "left_foot_index"
  | "right_foot_index"

export type Landmark = {
  x: number
  y: number
  z: number
  visibility: number
  type: LandmarkType
}

export type PoseFrame = {
  timestamp: number
  landmarks: Landmark[]
  confidence: number
}

export type PoseObservationState =
  | "Stable"
  | "Repeated"
  | "Uneven"
  | "Active"
  | "Consistent"
  | "Interrupted"
  | "Waiting"
  | "Unavailable"

export type MissionPoseObservation = {
  label: string
  state: PoseObservationState
  confidence: number
  evidence: string
}

export type PoseLandmarkRead = {
  status: "initializing" | "available" | "unavailable"
  provider: "mediapipePoseProvider"
  frameCount: number
  confidence: number
  persistence: number
  observations: MissionPoseObservation[]
  summary: string
}

export type PoseProviderOptions = {
  wasmBaseUrl?: string
  modelAssetPath?: string
}
