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
    text: "Five free throws. Weak hand only.",
  },
  {
    constraint: "Finish at the Rim",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-002",
    objective: "Baseline Drive",
    requiredEvidence: "OBSERVATION",
    text: "Baseline drive. Finish at the rim.",
  },
  {
    constraint: "Both Sides",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-003",
    objective: "Post Moves",
    requiredEvidence: "COUNT",
    text: "Post moves. Both sides.",
  },
  {
    constraint: "Three Arc Spots",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-004",
    objective: "Catch and Shoot",
    requiredEvidence: "COUNT",
    text: "Catch and shoot. Three spots.",
  },
  {
    constraint: "Eyes Up",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-005",
    objective: "10 Dribbles",
    requiredEvidence: "OBSERVATION",
    text: "Ten dribbles. Left hand. Eyes up. What did you notice?",
  },
];

// VISION domain — awareness through observation
// Context determines which challenges reality can satisfy.
// Level 1: Awareness — establish the habit of noticing
// Level 2: Recognition — identify specific elements
// Level 3: Anticipation — see it before it happens
export const VISION_CHALLENGES: AxisChallenge[] = [
  // Level 1 — Awareness
  {
    constraint: "Eyes Up",
    contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
    id: "ch-v01",
    objective: "Eyes Up Dribble",
    requiredEvidence: "OBSERVATION",
    text: "Ten dribbles. Left hand. Eyes up. What did you notice?",
  },
  {
    constraint: "Locate Help",
    contexts: ["PARTNER", "TEAM", "GAME"],
    id: "ch-v02",
    objective: "Find Help Defender",
    requiredEvidence: "OBSERVATION",
    text: "Drive baseline. Find the help defender. What did you notice?",
  },
  {
    constraint: "Corner First",
    contexts: ["TEAM", "GAME"],
    id: "ch-v03",
    objective: "See The Corner",
    requiredEvidence: "OBSERVATION",
    text: "Catch and shoot. See the corner before you catch. What did you notice?",
  },
  // Level 2 — Recognition
  {
    constraint: "First Movement",
    contexts: ["PARTNER", "TEAM", "GAME"],
    id: "ch-v04",
    objective: "Read First Movement",
    requiredEvidence: "OBSERVATION",
    text: "Drive to the rim. Which defender moved first? What did you notice?",
  },
  {
    constraint: "Help Side",
    contexts: ["TEAM", "GAME"],
    id: "ch-v05",
    objective: "Identify Helper",
    requiredEvidence: "OBSERVATION",
    text: "Attack the lane. Who was helping? What did you notice?",
  },
  {
    constraint: "Open Space",
    contexts: ["TEAM", "GAME"],
    id: "ch-v06",
    objective: "Find Open Space",
    requiredEvidence: "OBSERVATION",
    text: "Make three passes. Where was the open space? What did you notice?",
  },
  // Level 3 — Anticipation
  {
    constraint: "Read The Play",
    contexts: ["TEAM", "GAME"],
    id: "ch-v07",
    objective: "Anticipate Action",
    requiredEvidence: "OBSERVATION",
    text: "Set a screen. What was about to happen? What did you notice?",
  },
  {
    constraint: "Pass Ahead",
    contexts: ["PARTNER", "TEAM", "GAME"],
    id: "ch-v08",
    objective: "Locate Next Pass",
    requiredEvidence: "OBSERVATION",
    text: "Receive the entry pass. Where was the next pass going? What did you notice?",
  },
  {
    constraint: "Pre-Catch Read",
    contexts: ["TEAM", "GAME"],
    id: "ch-v09",
    objective: "Pre-Catch Awareness",
    requiredEvidence: "OBSERVATION",
    text: "Catch on the wing. Which player was open before you caught it? What did you notice?",
  },
];
