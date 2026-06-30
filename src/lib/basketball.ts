export type BasketballSessionType = "training" | "practice" | "game" | "workout";

export type CameraFacing = "front" | "rear";

export type FullBodyFrameStatus = {
  bodyDetected: boolean;
  fullBodyVisible: boolean;
  upperBodyVisible: boolean;
  lowerBodyVisible: boolean;
  feetVisible: boolean;
  leftSideVisible: boolean;
  rightSideVisible: boolean;
  confidence: number;
  message: string;
};

export type FullBodyReadValue =
  | "full body"
  | "partial body"
  | "no body"
  | "narrow"
  | "normal"
  | "wide"
  | "balanced"
  | "left-heavy"
  | "right-heavy"
  | "forward"
  | "backward"
  | "unstable"
  | "low"
  | "medium"
  | "high"
  | "level"
  | "tilted left"
  | "tilted right"
  | "upright"
  | "forward lean"
  | "backward lean"
  | "stable";

export type AxisFullBodyFrame = {
  sessionId: string;
  timestampMs: number;
  cameraFacing: CameraFacing;
  frameStatus: Omit<FullBodyFrameStatus, "message">;
  landmarks: Array<{
    name: string;
    x: number;
    y: number;
    z?: number;
    visibility?: number;
  }>;
  bodyStructure: {
    bodyCenter?: { x: number; y: number };
    shoulderLineAngle?: number;
    hipLineAngle?: number;
    spineAngle?: number;
    headOverHips?: "stacked" | "forward" | "back" | "left" | "right";
    torsoLean?: "upright" | "forward" | "backward" | "left" | "right";
    bodyHeightEstimate?: number;
  };
  base: {
    stanceWidth?: "narrow" | "normal" | "wide";
    leftFootVisible: boolean;
    rightFootVisible: boolean;
    baseStable?: boolean;
    balance?: "balanced" | "left-heavy" | "right-heavy" | "forward" | "backward" | "unstable";
  };
  jointAngles: {
    leftKnee?: number;
    rightKnee?: number;
    leftHip?: number;
    rightHip?: number;
    leftAnkle?: number;
    rightAnkle?: number;
    leftElbow?: number;
    rightElbow?: number;
    leftShoulder?: number;
    rightShoulder?: number;
  };
  movement: {
    bodyCenterVelocity?: number;
    verticalChange?: number;
    lateralChange?: number;
    kneeBendChange?: number;
    hipDropChange?: number;
    footPlantChange?: string;
  };
  reads: {
    frameRead: "no_body" | "partial_body" | "full_body";
    stanceRead?: string;
    balanceRead?: string;
    kneeBendRead?: string;
    hipLevelRead?: string;
    shoulderLevelRead?: string;
    torsoLeanRead?: string;
    movementQualityRead?: string;
    notes: string[];
  };
};

export type AxisFullBodyAIContext = {
  sessionId: string;
  cameraFacing: CameraFacing;
  frameRate?: number;
  frames: AxisFullBodyFrame[];
  summary: {
    totalFrames: number;
    fullBodyFrames: number;
    partialBodyFrames: number;
    noBodyFrames: number;
    averageConfidence: number;
    mostCommonFrameIssue?: string;
  };
  bodyReadTimeline: Array<{
    timestampMs: number;
    frameRead: "no_body" | "partial_body" | "full_body";
    stanceRead?: string;
    balanceRead?: string;
    kneeBendRead?: string;
    hipLevelRead?: string;
    shoulderLevelRead?: string;
    torsoLeanRead?: string;
    movementQualityRead?: string;
    notes: string[];
  }>;
};

export type BasketballSession = {
  id: string;
  userId: string;
  title: string;
  sessionType: BasketballSessionType;
  location?: string;
  status: "active";
  persisted: boolean;
};

export const sessionTypes: BasketballSessionType[] = [
  "training",
  "practice",
  "game",
  "workout",
];
