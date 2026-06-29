export type BasketballSessionType = "training" | "practice" | "game" | "workout";

export type BasketballOverlayMode =
  | "court-zones"
  | "delta-offense"
  | "shot-chart"
  | "spacing-shapes";

export type BasketballCourtSidePreset =
  | "sideline"
  | "baseline"
  | "corner"
  | "half-court"
  | "shooting-machine";

export type BasketballOverlayTransform = {
  visible: boolean;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
  flipHorizontal: boolean;
  verticalOffset: number;
};

export type BasketballOverlayCalibration = {
  courtSidePreset: BasketballCourtSidePreset;
  cornerPins: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
  aiContext: string;
};

export type BasketballOverlaySettings = {
  calibrationVersion: 1;
  source: "live-camera-overlay";
};

export type BasketballRecording = {
  id: string;
  userId: string;
  sessionId: string;
  overlayConfigId: string;
  localBlobUrl?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  status: "created" | "recording" | "complete";
  metadata: {
    mimeType?: string;
    source: "browser-media-recorder";
  };
  persisted: boolean;
};

export type BasketballAIEventCandidate = {
  id: string;
  userId: string;
  sessionId: string;
  recordingId?: string;
  overlayConfigId?: string;
  eventType: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  confidence?: number;
  reason?: string;
  overlayContext: Record<string, unknown>;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  reviewStatus: "pending" | "approved" | "rejected" | "corrected";
};

export type BasketballReviewedEvent = {
  id: string;
  userId: string;
  candidateId?: string;
  sessionId: string;
  recordingId?: string;
  eventType: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  confidence?: number;
  reviewStatus: "approved" | "corrected";
  metadata: Record<string, unknown>;
  persisted: boolean;
};

export type BasketballClip = {
  id: string;
  userId: string;
  sessionId: string;
  recordingId?: string;
  eventId?: string;
  title: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  storagePath?: string;
  status: "created" | "error";
  persisted: boolean;
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

export type BasketballOverlayConfig = {
  id: string;
  userId: string;
  sessionId: string;
  overlayType: BasketballOverlayMode;
  opacity: number;
  visible: boolean;
  transform: BasketballOverlayTransform;
  calibration: BasketballOverlayCalibration;
  settings: BasketballOverlaySettings;
  persisted: boolean;
};

export const overlayModeLabels: Record<BasketballOverlayMode, string> = {
  "court-zones": "Court Zones",
  "delta-offense": "Delta Offense",
  "shot-chart": "Shot Chart",
  "spacing-shapes": "Spacing Shapes",
};

export const sessionTypes: BasketballSessionType[] = [
  "training",
  "practice",
  "game",
  "workout",
];

export const courtSidePresetLabels: Record<BasketballCourtSidePreset, string> = {
  sideline: "Sideline",
  baseline: "Baseline",
  corner: "Corner",
  "half-court": "Half court",
  "shooting-machine": "Shooting machine",
};

export const defaultOverlayTransform: BasketballOverlayTransform = {
  visible: true,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotation: 0,
  flipHorizontal: false,
  verticalOffset: 0,
};

export const defaultOverlayCalibration: BasketballOverlayCalibration = {
  courtSidePreset: "sideline",
  cornerPins: {
    topLeft: { x: 0.04, y: 0.05 },
    topRight: { x: 0.96, y: 0.05 },
    bottomLeft: { x: 0.04, y: 0.95 },
    bottomRight: { x: 0.96, y: 0.95 },
  },
  aiContext: "Live camera court overlay calibration for future zone-aware event tagging.",
};

export const defaultOverlaySettings: BasketballOverlaySettings = {
  calibrationVersion: 1,
  source: "live-camera-overlay",
};
