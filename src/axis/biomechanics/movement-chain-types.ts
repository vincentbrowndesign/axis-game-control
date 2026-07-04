export type AxisChainNodeKind = "foot" | "ankle" | "knee" | "hip" | "trunk";

export type AxisChainReviewState = "ready" | "needs_review" | "uncertain";

export type AxisChainNode = {
  confidence: number;
  id: string;
  kind: AxisChainNodeKind;
  label: string;
  side: "left" | "right" | "center";
  x: number;
  y: number;
};

export type AxisChainLink = {
  confidence: number;
  fromNodeId: string;
  id: string;
  state: "ready" | "weak";
  toNodeId: string;
};

export type AxisMovementChain = {
  confidence: number;
  id: string;
  kind: "load_chain";
  links: AxisChainLink[];
  nodes: AxisChainNode[];
  reviewState: AxisChainReviewState;
  sessionId: string;
  timestampMs: number;
};
