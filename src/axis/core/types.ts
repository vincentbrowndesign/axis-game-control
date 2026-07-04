export type AxisCapabilityStatus = "active" | "available" | "disabled" | "deprecated" | "planned";

export type AxisReleaseName =
  | "Axis A1.0"
  | "Axis A1.1"
  | "Axis A1.2"
  | "Axis A1.3"
  | "Axis A1.4"
  | "Axis A1.5"
  | "Axis A1.6";

export type AxisCapability = {
  id: string;
  name: string;
  release: AxisReleaseName;
  status: AxisCapabilityStatus;
  input: Array<AxisSignal["kind"] | AxisEvidence["kind"]>;
  output: Array<AxisEvidence["kind"] | AxisSessionObject["kind"] | "memory_page">;
  mainUiVisible: boolean;
  labVisible: boolean;
  summary: string;
};

export type AxisSignal = {
  id: string;
  createdAt: string;
  elapsedMs?: number;
  kind: "tap" | "typed" | "voice";
  source: "user";
  text: string;
};

export type AxisEvidence = {
  id: string;
  capturedAt: string;
  capabilityId: string;
  kind: "frame" | "clip" | "pose" | "measurement" | "object_detection" | "proof_frame" | "vision_read" | "manual_mark";
  media?: {
    blob?: Blob;
    dataUrl?: string;
    height?: number;
    mimeType?: string;
    objectUrl?: string;
    width?: number;
  };
  observations?: AxisObservation[];
  metadata?: Record<string, unknown>;
  sessionId?: string;
  summary: string;
  trust: "user_captured" | "local_computed" | "server_computed";
};

export type AxisObservation = {
  label: string;
  value?: number | string;
  unit?: "deg" | "ratio" | "state";
};

export type AxisSessionObject = {
  id: string;
  createdAt: string;
  evidenceIds: string[];
  kind: "moment" | "rep" | "measurement" | "object" | "note" | "vision_read";
  label: string;
  reviewState?: "ready" | "needs_review" | "uncertain";
  searchableText: string;
  sessionId: string;
};

export type AxisDetectedObjectKind = "player" | "ball" | "rim" | "unknown";

export type AxisDetectedObject = {
  id: string;
  box?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  confidence: number;
  kind: AxisDetectedObjectKind;
  label: AxisDetectedObjectKind;
  point?: {
    x: number;
    y: number;
  };
  source: "huggingface" | "manual" | "local" | "mediapipe" | "tensorflow-coco-ssd";
};

export type AxisPlayerLockState = "searching" | "review" | "locked" | "lost" | "error" | "saved";

export type AxisRimBox = {
  confidence: 1;
  createdAt: string;
  height: number;
  id: string;
  sessionId: string;
  source: "manual_calibration";
  width: number;
  x: number;
  y: number;
};

export type AxisObjectTrack = {
  id: string;
  confidence: number;
  kind: Exclude<AxisDetectedObjectKind, "unknown">;
  label: "Player" | "Ball" | "Rim";
  lastSeenMs: number;
  points: Array<{
    timestampMs: number;
    x: number;
    y: number;
  }>;
};

export type AxisMotionHint = {
  confidence: number;
  kind:
    | "stationary"
    | "moving"
    | "rising"
    | "falling"
    | "unknown"
    | "ball_near_rim"
    | "ball_entered_rim_zone"
    | "ball_moving_toward_rim"
    | "possible_shot_attempt";
  objectKind: AxisDetectedObjectKind;
  summary: string;
};

export type AxisVisionRead = {
  id: string;
  sessionId: string;
  timestampMs: number;
  cameraFacingMode?: "user" | "environment";
  command?: string;
  frameId?: string;
  lockState: AxisPlayerLockState;
  note?: string;
  objects: AxisDetectedObject[];
  rimBox?: AxisRimBox;
  motionHints: AxisMotionHint[];
  source: "huggingface" | "local" | "manual";
  confidence: number;
  reviewState: "ready" | "needs_review" | "uncertain" | "error";
};

export type AxisMomentCandidate = {
  id: string;
  sessionId: string;
  timestampMs: number;
  title: string;
  situation?: string;
  actor?: string;
  action?: string;
  outcome?: string;
  cause?: string;
  correction?: string;
  evidenceIds: string[];
  reviewState: "ready" | "needs_review" | "uncertain";
};

export type AxisMemoryPage = {
  id: string;
  createdAt: string;
  objectIds: string[];
  searchableText: string;
  sessionId: string;
  title: string;
};

export type AxisCapabilityRun = {
  id: string;
  capabilityId: string;
  completedAt?: string;
  evidenceIds: string[];
  inputEvidenceIds: string[];
  startedAt: string;
  status: "queued" | "running" | "complete" | "failed" | "skipped";
};
