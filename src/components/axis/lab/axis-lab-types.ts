export type AxisLabPreviewState = "empty" | "active" | "expanded";

export type AxisGameSessionStatus =
  | "setup"
  | "live"
  | "paused"
  | "ended";

export type AxisGameSessionSaveStatus =
  | "local"
  | "saving"
  | "saved"
  | "unsaved"
  | "error";

export type AxisGameSession = {
  id: string;
  title: string;
  opponent?: string;
  startedAt?: string;
  endedAt?: string;
  sourceType: "manual" | "camera" | "stream" | "upload";
  sourceStartedAt?: string;
  status: AxisGameSessionStatus;
  saveStatus: AxisGameSessionSaveStatus;
};

export type AxisRealityMarkLabel =
  | "proof"
  | "turnover"
  | "rushing"
  | "spacing"
  | "score"
  | "stop"
  | "foul"
  | "question"
  | "clip"
  | "custom";

export type AxisRealityMark = {
  gameSessionId: string;
  id: string;
  label: AxisRealityMarkLabel;
  linkedSourceId?: string;
  note?: string;
  postRollSeconds: number;
  preRollSeconds: number;
  provenance: "manual";
  sourceTime?: number;
  sourceType: "manual" | "camera" | "stream" | "upload";
  sessionTime: number;
  createdAt: string;
  verification: "unverified";
};

export type AxisLabTimelineEvent = {
  detail?: string;
  mark?: AxisRealityMark;
  mediaLabel?: string;
  meta?: string;
  time: string;
  title: string;
};

export type AxisLabProofCandidate = {
  boundary?: string;
  confidence?: "Unverified";
  duration: string;
  id?: string;
  meta: string;
  source?: string;
  time?: string;
  title: string;
};

export type AxisLabRecentReality = {
  duration?: string;
  kind: "Clip" | "Image" | "Voice" | "Note" | "Source" | "Reality Mark";
  mark?: AxisRealityMark;
  time?: string;
  title: string;
};

export type AxisLabContextDashboard = {
  actions: readonly {
    due: string;
    title: string;
  }[];
  activeContext: {
    keeper: string;
    mainText: string;
    nextMove: string;
    proofNeeded: string;
    support: string;
    tags: readonly string[];
  };
  openLoops: readonly string[];
  proofCandidates: readonly AxisLabProofCandidate[];
  recentReality: readonly AxisLabRecentReality[];
  savedAt: string;
  threadTitle: string;
  timeline: readonly AxisLabTimelineEvent[];
};
