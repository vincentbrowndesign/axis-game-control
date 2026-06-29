export type BasketballSessionType = "training" | "practice" | "game" | "workout";

export type CameraFacing = "user" | "environment";

export type BodyReadValue =
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
  | "upright"
  | "forward lean"
  | "backward lean"
  | "stable";

export type BodyReads = {
  stance: BodyReadValue;
  balance: BodyReadValue;
  kneeBend: BodyReadValue;
  hipLevel: BodyReadValue;
  shoulderLevel: BodyReadValue;
  torsoLean: BodyReadValue;
  bodyCenter: BodyReadValue;
  movementQuality: BodyReadValue;
};

export type BodyPoint = {
  x: number;
  y: number;
  z?: number;
  confidence: number;
};

export type BasketballBodyFrame = {
  timestamp: number;
  cameraFacing: CameraFacing;
  bodyDetected: boolean;
  landmarks: Record<string, BodyPoint>;
  landmarkConfidence: number;
  bodyCenter: BodyPoint | null;
  shoulderLineAngle: number | null;
  hipLineAngle: number | null;
  spineAngle: number | null;
  torsoLean: BodyReadValue;
  stanceWidth: BodyReadValue;
  balanceEstimate: BodyReadValue;
  kneeAngles: { left: number | null; right: number | null };
  hipAngles: { left: number | null; right: number | null };
  elbowAngles: { left: number | null; right: number | null };
  verticalChange: number;
  lateralChange: number;
  bodyCenterVelocity: number;
  kneeBendChange: number;
  hipDropChange: number;
  reads: BodyReads;
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
