import type { AxisEvidenceRecord, AxisMissingEvidence } from "./axis-reconstruction";

export type AxisClaimStatus = "supported" | "contested" | "unsupported";

export type AxisClaimConfidence = "low" | "medium" | "high";

export type AxisClaimSupport = {
  evidence_id: string;
  relevance: number;
  reason: string;
};

export type AxisClaimContradiction = {
  evidence_id: string;
  severity: number;
  reason: string;
};

export type AxisClaimDraft = {
  id: string;
  claim: string;
  source: string;
  supporting_evidence?: AxisClaimSupport[];
  contradictory_evidence?: AxisClaimContradiction[];
  missing_evidence_ids?: string[];
};

export type AxisTraceableClaim = {
  id: string;
  claim: string;
  source: string;
  status: AxisClaimStatus;
  supporting_evidence: Array<AxisClaimSupport & { evidence: AxisEvidenceRecord }>;
  contradictory_evidence: Array<AxisClaimContradiction & { evidence: AxisEvidenceRecord }>;
  missing_evidence: AxisMissingEvidence[];
  confidence: number;
  confidence_level: AxisClaimConfidence;
  allowed: boolean;
  rejection_reason?: string;
};

export type AxisEvidenceLedger = {
  evidence: AxisEvidenceRecord[];
  missing_evidence: AxisMissingEvidence[];
  claims: AxisTraceableClaim[];
  unsupported_claims: AxisTraceableClaim[];
};

export type AxisEvidenceGateOptions = {
  minimum_support?: number;
  contested_threshold?: number;
};

const DEFAULT_MINIMUM_SUPPORT = 0.52;
const DEFAULT_CONTESTED_THRESHOLD = 0.35;

export function buildAxisEvidenceLedger(
  drafts: AxisClaimDraft[],
  evidence: AxisEvidenceRecord[],
  missingEvidence: AxisMissingEvidence[] = [],
  options: AxisEvidenceGateOptions = {},
): AxisEvidenceLedger {
  const claims = drafts.map((draft) => traceAxisClaim(draft, evidence, missingEvidence, options));

  return {
    evidence,
    missing_evidence: missingEvidence,
    claims,
    unsupported_claims: claims.filter((claim) => !claim.allowed),
  };
}

export function traceAxisClaim(
  draft: AxisClaimDraft,
  evidence: AxisEvidenceRecord[],
  missingEvidence: AxisMissingEvidence[] = [],
  options: AxisEvidenceGateOptions = {},
): AxisTraceableClaim {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const missingById = new Map(missingEvidence.map((item) => [item.id, item]));
  const supportingEvidence = resolveSupport(draft.supporting_evidence ?? [], evidenceById);
  const contradictoryEvidence = resolveContradictions(draft.contradictory_evidence ?? [], evidenceById);
  const missing = (draft.missing_evidence_ids ?? [])
    .map((id) => missingById.get(id))
    .filter((item): item is AxisMissingEvidence => Boolean(item));
  const confidence = scoreClaimConfidence(supportingEvidence, contradictoryEvidence, missing);
  const status = classifyClaimStatus(confidence, supportingEvidence, contradictoryEvidence, options);
  const allowed = status !== "unsupported";

  return {
    id: draft.id,
    claim: draft.claim,
    source: draft.source,
    status,
    supporting_evidence: supportingEvidence,
    contradictory_evidence: contradictoryEvidence,
    missing_evidence: missing,
    confidence,
    confidence_level: confidenceLevel(confidence),
    allowed,
    rejection_reason: allowed ? undefined : rejectionReason(supportingEvidence, contradictoryEvidence, missing),
  };
}

export function assertTraceableClaim(claim: AxisTraceableClaim): AxisTraceableClaim {
  if (!claim.allowed) {
    throw new Error(`UNSUPPORTED_AXIS_CLAIM: ${claim.id}: ${claim.rejection_reason ?? "missing support"}`);
  }

  return claim;
}

export function filterSupportedClaims(claims: AxisTraceableClaim[]): AxisTraceableClaim[] {
  return claims.filter((claim) => claim.allowed);
}

function resolveSupport(support: AxisClaimSupport[], evidenceById: Map<string, AxisEvidenceRecord>) {
  return support
    .map((item) => {
      const evidence = evidenceById.get(item.evidence_id);
      if (!evidence) return null;
      return {
        ...item,
        relevance: clamp(item.relevance),
        evidence,
      };
    })
    .filter((item): item is AxisClaimSupport & { evidence: AxisEvidenceRecord } => Boolean(item));
}

function resolveContradictions(
  contradictions: AxisClaimContradiction[],
  evidenceById: Map<string, AxisEvidenceRecord>,
) {
  return contradictions
    .map((item) => {
      const evidence = evidenceById.get(item.evidence_id);
      if (!evidence) return null;
      return {
        ...item,
        severity: clamp(item.severity),
        evidence,
      };
    })
    .filter((item): item is AxisClaimContradiction & { evidence: AxisEvidenceRecord } => Boolean(item));
}

function scoreClaimConfidence(
  support: Array<AxisClaimSupport & { evidence: AxisEvidenceRecord }>,
  contradictions: Array<AxisClaimContradiction & { evidence: AxisEvidenceRecord }>,
  missing: AxisMissingEvidence[],
) {
  if (support.length === 0) return 0;

  const supportScore = support.reduce((sum, item) => sum + item.relevance * item.evidence.confidence, 0) / support.length;
  const contradictionPenalty = contradictions.reduce(
    (sum, item) => sum + item.severity * item.evidence.confidence,
    0,
  );
  const missingPenalty = Math.min(0.35, missing.length * 0.08);

  return clamp(supportScore - contradictionPenalty - missingPenalty);
}

function classifyClaimStatus(
  confidence: number,
  support: Array<AxisClaimSupport & { evidence: AxisEvidenceRecord }>,
  contradictions: Array<AxisClaimContradiction & { evidence: AxisEvidenceRecord }>,
  options: AxisEvidenceGateOptions,
): AxisClaimStatus {
  const minimumSupport = options.minimum_support ?? DEFAULT_MINIMUM_SUPPORT;
  const contestedThreshold = options.contested_threshold ?? DEFAULT_CONTESTED_THRESHOLD;
  const contradictionScore = contradictions.reduce(
    (sum, item) => sum + item.severity * item.evidence.confidence,
    0,
  );

  if (support.length === 0) return "unsupported";
  if (confidence < minimumSupport) return "unsupported";
  if (contradictionScore >= contestedThreshold) return "contested";
  return "supported";
}

function rejectionReason(
  support: Array<AxisClaimSupport & { evidence: AxisEvidenceRecord }>,
  contradictions: Array<AxisClaimContradiction & { evidence: AxisEvidenceRecord }>,
  missing: AxisMissingEvidence[],
) {
  if (support.length === 0) return "No supporting evidence was linked to this claim.";
  if (contradictions.length > 0) return "Contradictory evidence overwhelms support.";
  if (missing.length > 0) return "Required evidence is missing.";
  return "Supporting evidence is below the confidence threshold.";
}

function confidenceLevel(confidence: number): AxisClaimConfidence {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
