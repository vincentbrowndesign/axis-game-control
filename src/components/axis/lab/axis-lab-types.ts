export type AxisLabPreviewState = "empty" | "active" | "expanded";

export type AxisLabDetail = {
  action?: string;
  confidence?: string;
  relatedNotes?: readonly string[];
  source?: string;
  title: string;
};

export type AxisLabMark = {
  accent: "context" | "proof" | "action";
  detail?: AxisLabDetail;
  id: string;
  label: string;
  text: string;
};

export type AxisLabThread = {
  axisSentence: string;
  contextMark?: AxisLabMark;
  proofMark?: AxisLabMark;
  sessionTime: string;
  thought: string;
  title: string;
};
