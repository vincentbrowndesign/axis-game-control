import type { ReactNode } from "react";

export type AxisContextTimelineItem = {
  detail?: string;
  id: string;
  mediaKind?: "clip" | "voice" | "image" | "note";
  mediaLabel?: string;
  meta?: string;
  time: string;
  title: string;
};

export type AxisContextProofCandidate = {
  boundary?: string;
  confidence?: string;
  duration?: string;
  id: string;
  meta?: string;
  source?: string;
  time?: string;
  title: string;
};

export type AxisContextRecentItem = {
  duration?: string;
  id: string;
  kind: "Clip" | "Image" | "Voice" | "Note" | "Source" | "Reality Mark";
  meta?: readonly string[];
  preview?: ReactNode;
  time?: string;
  title: string;
  variant?: string;
};

export type AxisContextDashboardShellProps = {
  actions?: readonly {
    due?: string;
    id: string;
    title: string;
  }[];
  activeContext?: {
    detail?: ReactNode;
    keeper?: string;
    label?: string;
    mainText: string;
    nextMove?: string;
    proofNeeded?: string;
    support?: string;
    tags?: readonly string[];
  };
  ariaLabel?: string;
  composer?: ReactNode;
  emptyState?: ReactNode;
  header: {
    actions?: ReactNode;
    savedAt?: string;
    savedDateTime?: string;
    status?: string;
    threadTitle: string;
  };
  lowerSourceRegion?: ReactNode;
  openLoops?: readonly {
    control?: ReactNode;
    id: string;
    text: string;
  }[];
  proofCandidates?: readonly AxisContextProofCandidate[];
  recentItems?: readonly AxisContextRecentItem[];
  timelineItems?: readonly AxisContextTimelineItem[];
};
