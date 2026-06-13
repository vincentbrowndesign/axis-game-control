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
    text: "Eyes Up. Ten dribbles. Left hand.",
  },
  {
    constraint: "Locate Help",
    contexts: ["PARTNER", "TEAM", "GAME"],
    id: "ch-v02",
    objective: "Find Help Defender",
    requiredEvidence: "OBSERVATION",
    text: "Find the helper. Drive baseline.",
  },
  {
    constraint: "Corner First",
    contexts: ["TEAM", "GAME"],
    id: "ch-v03",
    objective: "See The Corner",
    requiredEvidence: "OBSERVATION",
    text: "See the corner first. Catch and shoot.",
  },
  // Level 2 — Recognition
  {
    constraint: "First Movement",
    contexts: ["PARTNER", "TEAM", "GAME"],
    id: "ch-v04",
    objective: "Read First Movement",
    requiredEvidence: "OBSERVATION",
    text: "Read first movement. Drive to the rim.",
  },
  {
    constraint: "Help Side",
    contexts: ["TEAM", "GAME"],
    id: "ch-v05",
    objective: "Identify Helper",
    requiredEvidence: "OBSERVATION",
    text: "Name the helper. Attack the lane.",
  },
  {
    constraint: "Open Space",
    contexts: ["TEAM", "GAME"],
    id: "ch-v06",
    objective: "Find Open Space",
    requiredEvidence: "OBSERVATION",
    text: "Find open space. Three passes.",
  },
  // Level 3 — Anticipation
  {
    constraint: "Read The Play",
    contexts: ["TEAM", "GAME"],
    id: "ch-v07",
    objective: "Anticipate Action",
    requiredEvidence: "OBSERVATION",
    text: "See it before it happens. Set a screen.",
  },
  {
    constraint: "Pass Ahead",
    contexts: ["PARTNER", "TEAM", "GAME"],
    id: "ch-v08",
    objective: "Locate Next Pass",
    requiredEvidence: "OBSERVATION",
    text: "Locate the next pass. Receive the entry.",
  },
  {
    constraint: "Pre-Catch Read",
    contexts: ["TEAM", "GAME"],
    id: "ch-v09",
    objective: "Pre-Catch Awareness",
    requiredEvidence: "OBSERVATION",
    text: "Know before you catch. Catch on the wing.",
  },
];
