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

export type AxisSession = {
  id: string;
  title: string;
  playerName?: string;
  sessionType: "training" | "game" | "film" | "practice" | "other";
  status: "draft" | "active" | "processing" | "complete";
  createdAt: string;
};

export type AxisPlayer = {
  id: string;
  displayName: string;
  jerseyNumber?: string;
  position?: string;
  status: "draft" | "active";
  createdAt: string;
};

export type AxisMediaSource = {
  id: string;
  fileName: string;
  fileType: string;
  mediaType: "video" | "image" | "audio" | "document" | "unknown";
  sizeBytes: number;
  status: "local";
  createdAt: string;
  sessionId?: string;
};

export type AxisObjectContract = {
  name: string;
  status: string;
  owns: string[];
  doesNotOwn: string[];
  futureWiring: string[];
};

export type AxisAsk = {
  id: string;
  content: string;
  createdAt: string;
  sessionId?: string;
  status: "draft";
};

export type AxisChatMessage = {
  id: string;
  role: "user";
  content: string;
  createdAt: string;
  sessionId?: string;
  status: "local";
};

export type AxisAgent = {
  id: number;
  name: string;
  purpose: string;
  status: string;
  futureWiring: string;
  accent: "purple" | "gold" | "blue" | "green" | "orange" | "cyan";
  routeContract?: {
    accepts: string;
    decides: string;
    returns: string;
  };
  orchestrationContract?: {
    accepts: string[];
    decides: string[];
    returns: string[];
  };
  mediaIntakeContract?: {
    accepts: string[];
    decides: string[];
    returns: string[];
  };
  voiceContract?: {
    accepts: string[];
    decides: string[];
    returns: string[];
  };
  visionContract?: {
    accepts: string[];
    decides: string[];
    returns: string[];
  };
  videoUnderstandingContract?: {
    accepts: string[];
    decides: string[];
    returns: string[];
  };
  sessionMemoryContract?: {
    accepts: string[];
    decides: string[];
    returns: string[];
  };
  reportContract?: {
    accepts: string[];
    decides: string[];
    returns: string[];
  };
  followUpContract?: {
    accepts: string[];
    decides: string[];
    returns: string[];
  };
};

export type AxisBuildScreen = {
  id: string;
  title: string;
  items: string[];
};

export type AxisBuildOrderItem = {
  id: number;
  title: string;
  items?: string[];
};
