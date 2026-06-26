// Axis Evidence Scorer — scores and buckets findings from watch provider output.
// Pure function, no external imports. Consumed by deep-watch-provider.ts.

export type EvidenceBucket = "check_this" | "hidden_low_value" | "not_enough_evidence" | "report_ready";

export function scoreEvidence(
  labels: string[],
  confidence: number,
): { bucket: EvidenceBucket; evidenceScore: number } {
  const actionability = computeActionability(labels);
  const relevance = computeRelevance(labels, confidence);
  const reviewCost = computeReviewCost(labels, confidence);
  const evidenceScore = Math.max(0, confidence * relevance * actionability - reviewCost);

  const onlyUnclear = labels.length === 1 && labels[0] === "unclear";
  let bucket: EvidenceBucket;

  if (onlyUnclear || confidence < 0.44) {
    bucket = "not_enough_evidence";
  } else if (evidenceScore >= 0.30 && (confidence >= 0.65 || actionability >= 0.85)) {
    bucket = "report_ready";
  } else if (evidenceScore >= 0.18 && confidence >= 0.44) {
    bucket = "check_this";
  } else {
    bucket = "hidden_low_value";
  }

  return { bucket, evidenceScore: Number(evidenceScore.toFixed(3)) };
}

function computeActionability(labels: string[]): number {
  if (labels.includes("breakdown") || labels.includes("teaching_moment")) return 0.90;
  if (labels.includes("spacing_issue") || labels.includes("clean_sequence")) return 0.80;
  if (labels.includes("speed_change") || labels.includes("group_action")) return 0.65;
  if (labels.includes("player_action")) return 0.60;
  if (labels.includes("person_visible")) return 0.45;
  return 0.25;
}

function computeRelevance(labels: string[], confidence: number): number {
  if (labels.includes("unclear")) return confidence * 0.6;
  const coachingCount = labels.filter((l) =>
    ["breakdown", "teaching_moment", "spacing_issue", "clean_sequence"].includes(l),
  ).length;
  return Math.min(1.0, confidence + coachingCount * 0.10);
}

function computeReviewCost(labels: string[], confidence: number): number {
  const labelPenalty =
    labels.includes("unclear") ? 0.15
    : labels.includes("person_visible") ? 0.10
    : labels.includes("player_action") && labels.length === 1 ? 0.08
    : 0.03;
  return Math.min(0.25, (1 - confidence) * 0.3 + labelPenalty);
}
