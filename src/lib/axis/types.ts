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
