export type AxisDatasetReviewStatus =
  | "needs_review"
  | "accepted"
  | "rejected"
  | "needs_clip"
  | "needs_label"
  | "duplicate";

export type AxisDatasetReviewTarget =
  | "Axis Moment Example"
  | "Basketball Objects"
  | "Shot Truth"
  | "Footwork"
  | "Offense Decisions";

export type AxisDatasetReviewItem = {
  id: string;
  sessionId: string;
  momentId: string;
  playerId?: string;
  videoClipUrl?: string;
  imageUrl?: string;
  transcriptText?: string;
  coachNote: string;
  suggestedDataset: AxisDatasetReviewTarget;
  suggestedLabels: string[];
  situation: string;
  actor: string;
  action: string;
  outcome: string;
  cause: string;
  correction: string;
  evidence: string;
  reviewStatus: AxisDatasetReviewStatus;
  reviewerNote: string;
  createdAt: string;
};

export const axisDatasetReviewActions = [
  "Accept as Axis Moment Example",
  "Send to Basketball Objects",
  "Send to Shot Truth",
  "Send to Footwork",
  "Send to Offense Decisions",
  "Reject",
] as const;

export type AxisDatasetReviewAction = (typeof axisDatasetReviewActions)[number];

export const axisDatasetFlywheel = "session -> memory -> reviewed moment -> dataset example -> better Axis";

export const axisDatasetReviewItems = [
  {
    action: "catch and shoot",
    actor: "P1",
    cause: "feet were set before the pass arrived",
    coachNote: "Good example of a clean rep. Keep the release cue tied to the footwork.",
    correction: "repeat the same foot prep on the next set",
    createdAt: "2026-06-24T14:15:00.000Z",
    evidence: "short clip plus coach note",
    id: "review-catch-shoot-001",
    imageUrl: "/axis-placeholder-catch-shoot.jpg",
    momentId: "moment-042",
    outcome: "balanced release",
    playerId: "player-p1",
    reviewStatus: "needs_review",
    reviewerNote: "Needs label confirmation before training use.",
    sessionId: "session-2026-06-24-a",
    situation: "wing catch with no closeout",
    suggestedDataset: "Shot Truth",
    suggestedLabels: ["catch_shoot", "balanced_base", "clean_release"],
    transcriptText: "Good rep. Feet ready before the catch.",
    videoClipUrl: "/axis-placeholder-catch-shoot.mp4",
  },
  {
    action: "right-foot plant into finish",
    actor: "P2",
    cause: "plant step drifted outside the lane line",
    coachNote: "Useful correction example because the note explains why the miss happened.",
    correction: "shorten the plant and keep shoulder through the rim line",
    createdAt: "2026-06-24T14:22:00.000Z",
    evidence: "coach note only",
    id: "review-footwork-002",
    momentId: "moment-057",
    outcome: "off-balance finish",
    playerId: "player-p2",
    reviewStatus: "needs_clip",
    reviewerNote: "Clip needed before this becomes a dataset example.",
    sessionId: "session-2026-06-24-a",
    situation: "drive from right slot",
    suggestedDataset: "Footwork",
    suggestedLabels: ["right_plant", "finish_balance", "needs_clip"],
    transcriptText: "Again. Right plant is too wide.",
  },
  {
    action: "early pass read",
    actor: "P1",
    cause: "help defender stepped below the nail",
    coachNote: "Decision was correct even though the shot was missed.",
    correction: "tag as good decision, not make/miss result",
    createdAt: "2026-06-24T14:31:00.000Z",
    evidence: "memory note and still image",
    id: "review-decision-003",
    imageUrl: "/axis-placeholder-decision.jpg",
    momentId: "moment-071",
    outcome: "open corner shot created",
    playerId: "player-p1",
    reviewStatus: "needs_label",
    reviewerNote: "Needs offense decision labels.",
    sessionId: "session-2026-06-24-a",
    situation: "paint touch against help",
    suggestedDataset: "Offense Decisions",
    suggestedLabels: ["paint_touch", "kickout", "good_decision"],
    transcriptText: "That was the right kick. Good read.",
  },
] satisfies AxisDatasetReviewItem[];

export function listAxisDatasetReviewItems(): AxisDatasetReviewItem[] {
  return axisDatasetReviewItems;
}

export function getDatasetReviewStatusLabel(status: AxisDatasetReviewStatus) {
  return status.replaceAll("_", " ");
}

export function getDatasetReviewActionTarget(action: AxisDatasetReviewAction): AxisDatasetReviewTarget | "rejected" {
  if (action === "Accept as Axis Moment Example") return "Axis Moment Example";
  if (action === "Send to Basketball Objects") return "Basketball Objects";
  if (action === "Send to Shot Truth") return "Shot Truth";
  if (action === "Send to Footwork") return "Footwork";
  if (action === "Send to Offense Decisions") return "Offense Decisions";
  return "rejected";
}
