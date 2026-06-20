import type { AxisLabThread } from "./axis-lab-types";

export const axisLabThread: AxisLabThread = {
  sessionTime: "8:31 AM",
  context: {
    id: "first-six-context",
    label: "Active Context",
    savedPreviewStatus: "local_preview",
    statement: "First mistake cannot become the next rushed decision.",
    threadTitle: "Tournament Weekend Gameplan",
    axisSentence: "Keep the first six minutes simple: one mistake, then one calm next action.",
  },
  proofMark: {
    accent: "proof",
    id: "proof",
    label: "Proof needed",
    text: "Did the next possession speed up?",
    detail: {
      title: "Proof needed",
      source: "Suggested interpretation · Needs confirmation",
      confidence: "The source may support the context, but it has not been verified.",
      relatedNotes: [
        "Compare the possession after the first miss or turnover.",
        "Keep raw source separate from the interpretation.",
      ],
      action: "Review the next dead ball and name one rule.",
    },
  },
  nextMoveMark: {
    accent: "action",
    id: "next-move",
    label: "Next move",
    text: "Give one six-minute rule.",
    detail: {
      title: "Next move",
      action: "Tell them: one mistake, next simple pass.",
      relatedNotes: [
        "Short enough for a huddle.",
        "Keeps the team from carrying the mistake into the next action.",
      ],
    },
  },
  recentSourceMark: {
    accent: "source",
    id: "recent-source",
    label: "Recent reality",
    text: "Mock source · Preview only · No interpretation yet",
    detail: {
      title: "Recent reality",
      source: "Mock source · Preview only · No interpretation yet",
      confidence: "Raw source label only.",
      relatedNotes: [
        "This is not evidence.",
        "This is not a verified claim.",
      ],
    },
  },
};
