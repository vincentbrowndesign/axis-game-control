export type VisionObjectType = "player" | "rim" | "ball";

export type VisionObjectState =
  | "searching"
  | "candidate"
  | "locked"
  | "lost"
  | "manual_override";

export type VisionRelationshipType =
  | "possible_possession"
  | "shot_window"
  | "drive_window"
  | "finish_window"
  | "contested_window"
  | "lost_ball";

export type VisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisionObject = {
  id: string;
  type: VisionObjectType;
  label: string;
  bbox: VisionBox;
  confidence: number;
  state: VisionObjectState;
  trackId: string;
  selected: boolean;
  manuallyLocked: boolean;
  lastSeenAt: number;
  classId?: number;
  className?: string;
};

export type VisionTrack = {
  id: string;
  type: VisionObjectType;
  bbox: VisionBox;
  confidence: number;
  lastSeenAt: number;
};

export type VisionRelationship = {
  id: string;
  type: VisionRelationshipType;
  objectIds: string[];
  confidence: number;
  startedAt: number;
  endedAt?: number;
  metadata?: Record<string, unknown>;
};

export type VisionFrameState = {
  frameId: number;
  timestamp: number;
  objects: VisionObject[];
  relationships: VisionRelationship[];
  mode: "product" | "debug";
};

export type AxisVisionObjectEventType =
  | "vision_opened"
  | "camera_started"
  | "object_detected"
  | "object_locked"
  | "object_lost"
  | "player_selected"
  | "player_named"
  | "rim_locked"
  | "ball_possession_candidate"
  | "shot_window_detected"
  | "drive_window_detected"
  | "finish_window_detected"
  | "debug_mode_enabled";

export type AxisVisionObjectEvent = {
  id: string;
  type: AxisVisionObjectEventType;
  createdAt: string;
  payload?: Record<string, unknown>;
};
