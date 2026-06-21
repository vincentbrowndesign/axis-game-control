export type AxisOutput = {
  id: string;
  title: string;
  type:
    | "text"
    | "audio"
    | "image"
    | "video"
    | "clip"
    | "report"
    | "automation"
    | "file";
  status: "ready" | "processing" | "failed";
  createdAt: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  summary?: string;
  sourceLabel?: string;
};
