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
  localAttachment?: AxisLocalAttachment;
  summary?: string;
  sourceLabel?: string;
};

export type AxisRunRequestPreview = {
  id: string;
  inputText: string;
  selectedOutputType: AxisOutput["type"];
  targetRoute: "/api/axis/run";
  createdAt: string;
  status: "local_preview";
  sessionId?: string;
  mediaSourceId?: string;
  localAttachment?: AxisLocalAttachment;
  expectedOutputId?: string;
};

export type AxisRunPayload = {
  cameraCapture?: File;
  currentProject?: string;
  expectedOutputId?: string;
  inputText: string;
  localAttachment?: AxisLocalAttachment;
  mediaSourceId?: string;
  mode: "type" | "voice" | "upload" | "camera";
  outputType?: AxisOutput["type"];
  previewId?: string;
  targetRoute?: "/api/axis/run";
  sessionId?: string;
  uploadedFile?: File;
  userId?: string;
  voiceTranscript?: string;
};

export type AxisRunResultEnvelope = {
  createdAt: string;
  id: string;
  output: AxisOutput;
  payload?: AxisRunPayload;
  source: "local_preview";
  status: AxisOutput["status"];
};

export type AxisRunExecutionState = {
  enabled: boolean;
  label: string;
  message: string;
  targetRoute: "/api/axis/run";
};

export type AxisRunContractPreview = {
  execution: AxisRunExecutionState;
  isLinkedToOutput: boolean;
  payload?: AxisRunPayload;
  result: AxisRunResultEnvelope;
};

export type AxisRunContractValidation = {
  ok: boolean;
  label: string;
  message: string;
};

export type AxisRunWiringChecklistItem = {
  label: string;
  ready: boolean;
};

export type AxisRunSubmitGuard = {
  canSubmit: boolean;
  label: string;
  message: string;
};

export type AxisRunCompatibilityState = {
  compatible: boolean;
  label: string;
  message: string;
  route: "/api/axis/run";
};

export type AxisRunAdapterContract = {
  accepts: string[];
  returns: string[];
  status: "needed" | "ready";
  targetRoute: "/api/axis/run";
};

export type AxisRunRouteCompatibility = {
  compatible: boolean;
  reason?: string;
  missing: string[];
  canDryRun: boolean;
  canSubmit: false;
};

export type AxisRunAdapterPreview = {
  route: "/api/axis/run";
  method: "POST";
  compatible: boolean;
  dryRunOnly: true;
  submitLocked: true;
  payloadPreview: unknown;
  expectedResponsePreview: unknown;
  outputAdapterPreview: {
    willMapToAxisOutput: boolean;
    outputType: AxisOutput["type"];
    status: AxisOutput["status"];
  };
  missing: string[];
};

export type AxisRunAdapterDryRunPreview = {
  routeCalled: false;
  wouldSend: unknown;
  wouldReceive: unknown;
  wouldCreateOutput: AxisOutput;
  status: "dry_run_only";
  message: string;
};

export type AxisRunDryRunGuard = {
  canDryRun: boolean;
  label: string;
  message: string;
};

export type AxisRunDryRunRequest = {
  dryRun: true;
  input: string;
  mode: "text" | "voice" | "vision" | "image" | "video" | "file" | "report" | "automation";
  sessionId?: string;
  playerId?: string;
  projectId?: string;
  media?: {
    id?: string;
    type: "image" | "video" | "audio" | "file";
    name?: string;
    url?: string;
    size?: number;
  };
  requestedOutputType?: AxisOutput["type"];
  createdAt: string;
};

export type AxisRunDryRunResponse = {
  ok: true;
  dryRun: true;
  route: "/api/axis/run";
  receivedAt: string;
  accepted: {
    input: string;
    mode: AxisRunDryRunRequest["mode"];
    requestedOutputType?: AxisOutput["type"];
    hasMedia: boolean;
    sessionId?: string;
    playerId?: string;
    projectId?: string;
  };
  executionPlanPreview: {
    router: "pending";
    orchestrator: "pending";
    nextAgent: string;
    outputType: AxisOutput["type"];
    willWrite: false;
    willStartJob: false;
    willCallModel: false;
    willUploadMedia: false;
  };
};

export type AxisRunDryRunResult =
  | {
      ok: true;
      response: AxisRunDryRunResponse;
    }
  | {
      message: string;
      ok: false;
    };

export type AxisRunAdapterStatusPreview = {
  label: "Adapter handshake ready" | "Adapter handshake blocked";
  message: string;
  route: "/api/axis/run";
  accepted: boolean;
  outputType?: AxisOutput["type"];
  nextAgent?: string;
  noWrite: boolean;
  noJob: boolean;
  noModelCall: boolean;
  noUpload: boolean;
  submitLocked: true;
};

export type AxisRunDryRunHistoryItem = {
  id: string;
  outputId: string;
  outputTitle: string;
  createdAt: string;
  result: AxisRunDryRunResult;
};

export type AxisRunSubmitReadinessSummary = {
  canUnlockSubmit: false;
  label: "Submit still locked";
  completed: string[];
  remaining: string[];
  message: string;
};

export type AxisCommandValidationResult =
  | {
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

export type AxisLocalAttachment = {
  id: string;
  type: "image" | "video" | "audio" | "file";
  name: string;
  size?: number;
  previewUrl?: string;
  createdAt: string;
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
