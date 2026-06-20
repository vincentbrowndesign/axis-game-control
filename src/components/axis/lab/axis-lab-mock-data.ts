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
      source: "Possession after first turnover",
      suggestion: {
        status: "Suggested interpretation · Needs confirmation",
        confidence: "Medium preview confidence. The pattern still needs a clean source check.",
      },
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
      sourceDetail: {
        kind: "clip",
        range: "Q1 · 5:42-5:55",
        status: "Mock source · Preview only · No interpretation yet",
        thumbnailLabel: "Mock clip thumbnail",
      },
      relatedNotes: [
        "Raw source is separate from the active context.",
        "No interpretation has been attached yet.",
      ],
      action: "Open only long enough to decide whether it supports the current read.",
    },
  },
  openLoopMark: {
    accent: "loop",
    id: "open-loop",
    label: "Open loop",
    text: "First six still needs one huddle rule.",
    detail: {
      title: "Open loop",
      openLoops: [
        "Pick the one rule that survives noise.",
        "Decide whether the first miss or first turnover is the better trigger.",
        "Watch if the next possession slows down.",
      ],
      relatedNotes: [
        "Only the top loop stays visible while collapsed.",
        "This is a temporary preview list, not a permanent tracker.",
      ],
      action: "Close the loop by naming one rule before tip.",
    },
  },
};
