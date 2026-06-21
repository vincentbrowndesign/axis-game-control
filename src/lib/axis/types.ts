export type AxisOutputType =
  | "text"
  | "audio"
  | "image"
  | "video"
  | "clip"
  | "report"
  | "automation"
  | "file";

export type AxisOutputStatus = "ready" | "processing" | "failed";

export type AxisOutput = {
  id: string;
  title: string;
  type: AxisOutputType;
  status: AxisOutputStatus;
  createdAt: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  summary?: string;
  sourceLabel?: string;
};

export type AxisCapability = {
  id: string;
  title: string;
  description: string;
  status: "connected" | "ready" | "coming_soon";
};

export type AxisInputMode = "type" | "voice" | "upload" | "camera";

export type AxisNavigationItem = {
  id: string;
  label: string;
};

export type AxisRunStep = {
  id: string;
  label: string;
  status: "ready" | "loading" | "processing" | "failed" | "empty";
};

export type AxisActivityItem = {
  id: string;
  label: string;
  detail: string;
  status: "ready" | "processing" | "failed";
};

export type AxisProjectStatus = {
  activeProject: string;
  memoryState: "ready" | "empty" | "processing";
  queuedRuns: number;
  storageState: "ready" | "processing" | "failed";
};
