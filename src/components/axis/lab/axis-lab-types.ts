export type AxisLabPreviewState = "empty" | "active" | "expanded";

export type AxisRealityMarkLabel =
  | "proof"
  | "turnover"
  | "rushing"
  | "spacing"
  | "score"
  | "stop"
  | "teach"
  | "question"
  | "clip"
  | "custom";

export type AxisRealityMark = {
  id: string;
  label: AxisRealityMarkLabel;
  note?: string;
  sourceType: "manual" | "camera" | "stream" | "upload";
  verification: "unverified";
  sessionTime?: number;
  preRollSeconds?: number;
  postRollSeconds?: number;
  createdAt: string;
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
