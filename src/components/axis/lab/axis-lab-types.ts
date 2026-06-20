export type AxisLabPreviewState = "empty" | "active" | "expanded";

export type AxisLabTimelineEvent = {
  detail?: string;
  mediaLabel?: string;
  meta?: string;
  time: string;
  title: string;
};

export type AxisLabProofCandidate = {
  duration: string;
  meta: string;
  title: string;
};

export type AxisLabRecentReality = {
  duration?: string;
  kind: "Clip" | "Image" | "Voice" | "Note" | "Source";
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
