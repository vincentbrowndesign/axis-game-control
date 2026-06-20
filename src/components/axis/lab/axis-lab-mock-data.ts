import type { AxisLabThread } from "./axis-lab-types";

export const axisLabThread: AxisLabThread = {
  title: "First Six Minutes",
  sessionTime: "8:31 AM",
  thought: "We keep rushing after the first mistake.",
  axisSentence: "The first problem is not the mistake. It is the speed of the next decision.",
  contextMark: {
    accent: "context",
    id: "context",
    label: "Context",
    text: "Tournament weekend",
  },
  proofMark: {
    accent: "proof",
    id: "proof",
    label: "Proof needed",
    text: "Check the possession after the first mistake.",
    detail: {
      title: "Proof needed",
      source: "Mock clip range: first two possessions after turnovers",
      confidence: "Unverified signal",
      relatedNotes: [
        "Team speeds up after the first miss or turnover.",
        "The next decision decides whether the mistake doubles.",
      ],
      action: "Review the next dead ball and name one rule.",
    },
  },
};
