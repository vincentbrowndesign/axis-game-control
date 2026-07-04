import type { AxisEvidence } from "../core/types";

export type AxisAgentTool = {
  id: string;
  description: string;
  name: string;
};

export type AxisAgentToolCall = {
  id: string;
  createdAt: string;
  evidenceIds: AxisEvidence["id"][];
  input: string;
  status: "queued" | "running" | "complete" | "failed";
  toolId: AxisAgentTool["id"];
};
