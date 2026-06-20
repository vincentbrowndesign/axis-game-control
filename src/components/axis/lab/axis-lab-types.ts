export type AxisLabPreviewState = "empty" | "active" | "expanded";

export type AxisLabSourceDetail = {
  kind: "clip" | "image" | "voice" | "note";
  range: string;
  status: "Mock source · Preview only · No interpretation yet";
  thumbnailLabel: string;
};

export type AxisLabSuggestionDetail = {
  confidence?: string;
  status: "Suggested interpretation · Needs confirmation";
};

export type AxisLabDetail = {
  action?: string;
  openLoops?: readonly string[];
  relatedNotes?: readonly string[];
  sourceDetail?: AxisLabSourceDetail;
  source?: string;
  suggestion?: AxisLabSuggestionDetail;
  title: string;
};

export type AxisLabMark = {
  accent: "context" | "proof" | "action" | "source" | "loop";
  detail?: AxisLabDetail;
  id: string;
  label: string;
  text: string;
};

export type AxisContextObject = {
  axisSentence: string;
  id: string;
  label: "Active Context";
  savedPreviewStatus: "local_preview" | "saved_preview";
  statement: string;
  threadTitle: string;
};

export type AxisLabThread = {
  context: AxisContextObject;
  nextMoveMark?: AxisLabMark;
  openLoopMark?: AxisLabMark;
  proofMark?: AxisLabMark;
  recentSourceMark?: AxisLabMark;
  sessionTime: string;
};
