import type { AxisLabContextDashboard } from "./axis-lab-types";

export const axisLabDashboard: AxisLabContextDashboard = {
  threadTitle: "First Six Minutes",
  savedAt: "8:42 PM",
  timeline: [
    {
      time: "8:31 AM",
      title: "Open thread",
    },
    {
      detail: "\"We keep rushing after the first mistake.\"",
      time: "8:35 AM",
      title: "Rough thought",
    },
    {
      detail: "First six minutes matter most.",
      time: "8:41 AM",
      title: "Added note",
    },
    {
      mediaLabel: "Mock clip thumbnail",
      time: "8:42 PM",
      title: "Added source",
    },
    {
      detail: "Voice note",
      mediaLabel: "Mock waveform",
      meta: "0:18",
      time: "TODAY 6:15 PM",
      title: "Voice note",
    },
  ],
  activeContext: {
    mainText: "We keep rushing after the first mistake.",
    support: "The first problem is not the mistake. It is the speed of the next decision.",
    proofNeeded: "Check first two possessions after turnovers.",
    nextMove: "Give the team one rule for the first six minutes.",
    keeper: "No second mistake from rushing.",
    tags: ["team", "turnovers", "decision_speed"],
  },
  proofCandidates: [
    {
      duration: "0:12",
      meta: "Clip - 6:14 PM",
      title: "First possession after turnover",
    },
    {
      duration: "0:09",
      meta: "Clip - 6:15 PM",
      title: "Second possession after turnover",
    },
  ],
  openLoops: [
    "Is the rush caused by pressure or spacing?",
    "What rule slows the team without killing pace?",
    "Who enforces the rule in the first six minutes?",
  ],
  actions: [
    {
      due: "Tomorrow",
      title: "Write parent-facing message for tournament weekend.",
    },
  ],
  recentReality: [
    {
      duration: "0:12",
      kind: "Clip",
      time: "6:14 PM",
      title: "Turnover 1",
    },
    {
      duration: "0:09",
      kind: "Clip",
      time: "6:15 PM",
      title: "Turnover 2",
    },
    {
      kind: "Image",
      time: "5:48 PM",
      title: "Zone talk",
    },
    {
      duration: "0:18",
      kind: "Voice",
      time: "5:48 PM",
      title: "Coach voice note",
    },
    {
      kind: "Note",
      time: "5:40 PM",
      title: "Quick note",
    },
    {
      kind: "Source",
      title: "Add source",
    },
  ],
};
