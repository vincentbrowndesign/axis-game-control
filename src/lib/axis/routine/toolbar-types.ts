export type AxisToolbarMode =
  | "setup"
  | "ready"
  | "run"
  | "log"
  | "report"
  | "review"
  | "vision";

export type AxisToolbarTarget =
  | { type: "routine" }
  | { type: "field"; fieldId: string }
  | { type: "block"; blockId: string }
  | { type: "run" }
  | { type: "report" }
  | { type: "vision-event"; eventId: string };

export type AxisToolbarContext = {
  mode: AxisToolbarMode;
  target: AxisToolbarTarget;
  routineId?: string;
  selectedBlockId?: string;
  selectedFieldId?: string;
};

export type AxisPatch = {
  operation: "set" | "replace" | "rebalance" | "explain";
  path: string;
  value?: string | number | boolean | null;
  reason: string;
};

export type AxisCommand = {
  id: string;
  label: string;
  mode: AxisToolbarMode;
  target: AxisToolbarTarget;
  userInput?: string;
};

export type AxisSuggestion = {
  id: string;
  commandId: string;
  summary: string;
  explanation: string;
  patches: AxisPatch[];
  requiresReview: true;
};

export type AxisReviewDecision = {
  suggestionId: string;
  decision: "apply" | "ignore" | "edit";
  reviewedAt: string;
  reviewerNote?: string;
};
