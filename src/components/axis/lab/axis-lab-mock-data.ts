import type { AxisLabBoardCardData, AxisLabFocus, AxisLabTimelineEntry, AxisLabAnnotation } from "./axis-lab-types";

export const axisLabThreadTitle = "Tournament Weekend Gameplan";
export const axisLabSessionStartedAt = "2026-06-19T08:31:00-05:00";
export const axisLabBoardUpdatedAt = "2026-06-19T08:36:00-05:00";

export const axisLabFocus: AxisLabFocus = {
  title: "First Six Minutes",
  summary: "Control the first six minutes without overloading the team.",
};

export const axisLabTimeline: AxisLabTimelineEntry[] = [
  {
    id: "tl-1",
    kind: "user",
    label: "User",
    text: "We keep rushing after the first mistake.",
    timestamp: "2026-06-19T08:31:00-05:00",
  },
  {
    id: "tl-2",
    kind: "axis",
    label: "Axis",
    text: "The first problem is not the mistake. It is the speed of the next decision.",
    timestamp: "2026-06-19T08:32:00-05:00",
  },
  {
    id: "tl-3",
    kind: "user",
    label: "User",
    text: "We need one rule they can remember during the game.",
    timestamp: "2026-06-19T08:35:00-05:00",
  },
  {
    id: "tl-4",
    kind: "board",
    label: "Board updated",
    text: "First Six Minutes",
    timestamp: axisLabBoardUpdatedAt,
  },
];

export const axisActiveThreadMock: {
  threadTitle: string;
  userThought: string;
  axisResponse: string;
  timestamp: string;
  annotations: readonly AxisLabAnnotation[];
} = {
  threadTitle: "First Six Minutes",
  userThought: "We keep rushing after the first mistake.",
  axisResponse:
    "The first problem is not the mistake. It is the speed of the next decision.",
  timestamp: "8:31 AM",
  annotations: [
    { label: "PATTERN", note: "second mistake follows the first" },
    { label: "PROOF NEEDED", note: "check possessions after turnovers" },
  ],
};

export const axisLabBoardCards: AxisLabBoardCardData[] = [
  {
    id: "player-rule",
    title: "PLAYER RULE",
    status: "use",
    createdAt: axisLabBoardUpdatedAt,
    items: [
      "Make the simple next pass",
      "Sprint back after every shot",
      "No second mistake from rushing",
    ],
  },
  {
    id: "watch-next",
    title: "WATCH NEXT",
    status: "decide",
    createdAt: axisLabBoardUpdatedAt,
    items: [
      "Are turnovers coming from pace or spacing?",
      "Which lineup settles the ball?",
      "Does pressure change the first read?",
    ],
  },
  {
    id: "adjustment-trigger",
    title: "ADJUSTMENT TRIGGER",
    status: "fix",
    createdAt: axisLabBoardUpdatedAt,
    items: [
      "Two rushed possessions in a row",
      "No paint touch for three possessions",
      "Guards stop talking in transition",
    ],
  },
  {
    id: "source-signal",
    title: "SOURCE SIGNAL",
    status: "proof",
    note: "Source signal only - not verified evidence",
    createdAt: axisLabBoardUpdatedAt,
    items: [
      "Three early turnovers in the last game",
      "Two came immediately after missed shots",
    ],
  },
  {
    id: "later",
    title: "LATER",
    status: "parked",
    createdAt: axisLabBoardUpdatedAt,
    items: [
      "Full press package",
      "New baseline set",
      "Rotation experiment",
    ],
  },
  {
    id: "observation",
    title: "OBSERVATION",
    status: "neutral",
    createdAt: axisLabBoardUpdatedAt,
    items: [
      "Team plays best when the first action is simple",
      "Pressure increases after an early mistake",
    ],
  },
];
