import type { AxisEvidence, AxisMemoryPage, AxisSessionObject } from "../core/types";

export type AxisMemoryPromotion = {
  id: string;
  createdAt: string;
  evidenceId: AxisEvidence["id"];
  memoryPageId: AxisMemoryPage["id"] | null;
  reviewState: "ready" | "needs_review" | "uncertain";
  sessionObjectId: AxisSessionObject["id"] | null;
};
