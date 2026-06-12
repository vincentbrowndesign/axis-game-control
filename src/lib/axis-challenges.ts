import { type EvidenceKind } from "./axis-evidence";

export type AxisChallenge = {
  constraint: string;
  id: string;
  objective: string;
  requiredEvidence: EvidenceKind;
  text: string;
};

export const AXIS_CHALLENGES: AxisChallenge[] = [
  {
    constraint: "Weak Hand Only",
    id: "ch-001",
    objective: "5 Free Throws",
    requiredEvidence: "COUNT",
    text: "Five free throws. Weak hand only.",
  },
  {
    constraint: "Finish at the Rim",
    id: "ch-002",
    objective: "Baseline Drive",
    requiredEvidence: "OBSERVATION",
    text: "Baseline drive. Finish at the rim.",
  },
  {
    constraint: "Both Sides",
    id: "ch-003",
    objective: "Post Moves",
    requiredEvidence: "COUNT",
    text: "Post moves. Both sides.",
  },
  {
    constraint: "Three Arc Spots",
    id: "ch-004",
    objective: "Catch and Shoot",
    requiredEvidence: "COUNT",
    text: "Catch and shoot. Three spots.",
  },
  {
    constraint: "Eyes Up",
    id: "ch-005",
    objective: "10 Dribbles",
    requiredEvidence: "OBSERVATION",
    text: "Ten dribbles. Left hand. Eyes up. What did you notice?",
  },
];
