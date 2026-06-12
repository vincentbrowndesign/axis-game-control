import { type EvidenceKind } from "./axis-evidence";

export type AxisChallenge = {
  constraint: string;
  id: string;
  objective: string;
  requiredEvidence: EvidenceKind;
  text: string;
};

// Mixed-domain demo set
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

// VISION domain — awareness through observation
// Level 1: Awareness — establish the habit of noticing
// Level 2: Recognition — identify specific elements
// Level 3: Anticipation — see it before it happens
export const VISION_CHALLENGES: AxisChallenge[] = [
  // Level 1 — Awareness
  {
    constraint: "Eyes Up",
    id: "ch-v01",
    objective: "Eyes Up Dribble",
    requiredEvidence: "OBSERVATION",
    text: "Ten dribbles. Left hand. Eyes up. What did you notice?",
  },
  {
    constraint: "Locate Help",
    id: "ch-v02",
    objective: "Find Help Defender",
    requiredEvidence: "OBSERVATION",
    text: "Drive baseline. Find the help defender. What did you notice?",
  },
  {
    constraint: "Corner First",
    id: "ch-v03",
    objective: "See The Corner",
    requiredEvidence: "OBSERVATION",
    text: "Catch and shoot. See the corner before you catch. What did you notice?",
  },
  // Level 2 — Recognition
  {
    constraint: "First Movement",
    id: "ch-v04",
    objective: "Read First Movement",
    requiredEvidence: "OBSERVATION",
    text: "Drive to the rim. Which defender moved first? What did you notice?",
  },
  {
    constraint: "Help Side",
    id: "ch-v05",
    objective: "Identify Helper",
    requiredEvidence: "OBSERVATION",
    text: "Attack the lane. Who was helping? What did you notice?",
  },
  {
    constraint: "Open Space",
    id: "ch-v06",
    objective: "Find Open Space",
    requiredEvidence: "OBSERVATION",
    text: "Make three passes. Where was the open space? What did you notice?",
  },
  // Level 3 — Anticipation
  {
    constraint: "Read The Play",
    id: "ch-v07",
    objective: "Anticipate Action",
    requiredEvidence: "OBSERVATION",
    text: "Set a screen. What was about to happen? What did you notice?",
  },
  {
    constraint: "Pass Ahead",
    id: "ch-v08",
    objective: "Locate Next Pass",
    requiredEvidence: "OBSERVATION",
    text: "Receive the entry pass. Where was the next pass going? What did you notice?",
  },
  {
    constraint: "Pre-Catch Read",
    id: "ch-v09",
    objective: "Pre-Catch Awareness",
    requiredEvidence: "OBSERVATION",
    text: "Catch on the wing. Which player was open before you caught it? What did you notice?",
  },
];
