import type { AxisVisionRead } from "../core/types";

export type AxisClip = {
  id: string;
  createdAt: string;
  durationMs: number;
  overlayAttached: boolean;
  reviewState: "ready" | "needs_review" | "uncertain";
  savedReadId: AxisVisionRead["id"];
  sessionId: string;
};
