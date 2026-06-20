export type AxisLabPreviewState = "empty" | "active" | "expanded";

export type AxisLabDetail = {
  action?: string;
  confidence?: string;
  relatedNotes?: readonly string[];
  source?: string;
  title: string;
};

export type AxisLabMark = {
  accent: "context" | "proof" | "action" | "source";
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
  proofMark?: AxisLabMark;
  recentSourceMark?: AxisLabMark;
  sessionTime: string;
};
