export type AxisDetectionKind = "person" | "ball" | "other";

export type AxisLiveDetection = {
  id: string;
  label: string;
  score: number;
  bbox: [number, number, number, number];
  kind: AxisDetectionKind;
};

export type AxisVisionTrack = {
  trackId: string;
  kind: AxisDetectionKind;
  label: string;
  score: number;
  bbox: [number, number, number, number];
  firstSeenAt: number;
  lastSeenAt: number;
  seenFrames: number;
  missedFrames: number;
  status: "active" | "lost";
};

export type AxisVisionFrame = {
  frameId: number;
  timestamp: number;
  detections: AxisLiveDetection[];
  tracks: AxisVisionTrack[];
  peopleCount: number;
  ballCount: number;
  ballVisible: boolean;
};

export type AxisVisionSession = {
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  frames: AxisVisionFrame[];
  maxPeopleCount: number;
  ballSeenFrames: number;
  ballLostFrames: number;
};
