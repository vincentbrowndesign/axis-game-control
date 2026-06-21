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

export type AxisAgent = {
  id: number;
  name: string;
  purpose: string;
  status: string;
  futureWiring: string;
  accent: "purple" | "gold" | "blue" | "green" | "orange" | "cyan";
};

export type AxisBuildScreen = {
  id: string;
  title: string;
  items: string[];
};

export type AxisBuildOrderItem = {
  id: number;
  title: string;
};
