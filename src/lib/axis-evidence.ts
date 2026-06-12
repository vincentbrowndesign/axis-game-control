// COUNT: a numeric value ("43", "5")
// OBSERVATION: qualitative description of what happened
// PRESENCE: session duration was the evidence
// COMPLETION: binary self-report — done or not done

export type EvidenceKind = "COUNT" | "OBSERVATION" | "PRESENCE" | "COMPLETION";

// Where the evidence came from — the channel is irrelevant to evaluation
export type EvidenceSource = "VOICE" | "CAMERA" | "PRESENCE" | "COACH" | "USER" | "SYSTEM";

export type AxisEvidence = {
  kind: EvidenceKind;
  source: EvidenceSource;
  value: string | number | null;
};

export function evaluateEvidence(
  requiredKind: EvidenceKind,
  evidence: AxisEvidence,
): "SATISFIED" | "UNRESOLVED" {
  return evidence.kind === requiredKind ? "SATISFIED" : "UNRESOLVED";
}
