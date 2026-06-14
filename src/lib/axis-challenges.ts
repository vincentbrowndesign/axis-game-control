import { type EvidenceKind } from "./axis-evidence";

export type AxisContext = "SOLO" | "PARTNER" | "TEAM" | "GAME";

export type AxisChallenge = {
  constraint: string;
  contexts: AxisContext[];
  id: string;
  objective: string;
  requiredEvidence: EvidenceKind;
  text: string;
};

// Mixed-domain demo set — available in all contexts
export const AXIS_CHALLENGES: AxisChallenge[] = [
  {
    constraint: "Weak Hand Only",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-001",
    objective: "5 Free Throws",
    requiredEvidence: "COUNT",
    text: "Weak hand only. Five free throws.",
  },
  {
    constraint: "Finish at the Rim",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-002",
    objective: "Baseline Drive",
    requiredEvidence: "OBSERVATION",
    text: "Finish at the rim. Drive baseline.",
  },
  {
    constraint: "Both Sides",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-003",
    objective: "Post Moves",
    requiredEvidence: "COUNT",
    text: "Both sides. Post moves.",
  },
  {
    constraint: "Three Arc Spots",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-004",
    objective: "Catch and Shoot",
    requiredEvidence: "COUNT",
    text: "Three spots. Catch and shoot.",
  },
  {
    constraint: "Eyes Up",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-005",
    objective: "10 Dribbles",
    requiredEvidence: "OBSERVATION",
    text: "Eyes Up. Ten dribbles. Left hand.",
  },
];
