import type { AxisObservation, AxisPattern, AxisUnderstanding } from "./axis-server";

export type AxisEvidenceGapKind =
  | "matches_target"
  | "still_current"
  | "contradicts_target"
  | "missing_evidence";

export interface AxisEvidenceComparison {
  current: AxisPattern;
  target: AxisPattern;
  observed: Partial<AxisPattern>;
  expected: AxisPattern;
  gap: {
    kind: AxisEvidenceGapKind;
    summary: string;
    missing: string[];
    matched: string[];
  };
  adjustment: {
    type: "understanding" | "environment" | "evidence";
    summary: string;
  };
}

const EMPTY_PATTERN: AxisPattern = { label: "", objects: [], relationships: [], motion: [] };

export function compareEvidenceToUnderstanding(
  understanding: AxisUnderstanding,
  observation: AxisObservation | null | undefined,
): AxisEvidenceComparison {
  const current = understanding.currentPattern ?? EMPTY_PATTERN;
  const target = understanding.targetPattern ?? EMPTY_PATTERN;
  const observed = observation?.updates.currentPattern ?? {};
  const expected = target;
  const targetTerms = termsFromPattern(target);
  const observedTerms = termsFromPattern(partialToPattern(observed));
  const currentTerms = termsFromPattern(current);
  const matched = [...targetTerms].filter((term) => observedTerms.has(term));
  const missing = [...targetTerms].filter((term) => !observedTerms.has(term));
  const currentMatches = [...currentTerms].filter((term) => observedTerms.has(term));
  const kind = classifyGap({ observation, matched, missing, currentMatches, targetTerms });

  return {
    current,
    target,
    observed,
    expected,
    gap: {
      kind,
      summary: summarizeGap(kind, matched, missing, currentMatches),
      missing,
      matched,
    },
    adjustment: adjustmentFor(kind, missing),
  };
}

function classifyGap({
  observation,
  matched,
  missing,
  currentMatches,
  targetTerms,
}: {
  observation: AxisObservation | null | undefined;
  matched: string[];
  missing: string[];
  currentMatches: string[];
  targetTerms: Set<string>;
}): AxisEvidenceGapKind {
  if (!observation || !hasObservedPattern(observation)) return "missing_evidence";
  if (targetTerms.size > 0 && missing.length === 0) return "matches_target";
  if (currentMatches.length > 0 && matched.length === 0) return "still_current";
  return "contradicts_target";
}

function summarizeGap(
  kind: AxisEvidenceGapKind,
  matched: string[],
  missing: string[],
  currentMatches: string[],
): string {
  if (kind === "missing_evidence") return "Evidence did not show enough pattern detail to compare.";
  if (kind === "matches_target") return "Observed evidence matches the expected target pattern.";
  if (kind === "still_current") return `Observed evidence still shows ${currentMatches[0]}.`;
  if (matched.length > 0) return `Observed evidence shows ${matched[0]}, but is missing ${missing[0] ?? "the target pattern"}.`;
  return `Observed evidence is missing ${missing[0] ?? "the expected target pattern"}.`;
}

function adjustmentFor(
  kind: AxisEvidenceGapKind,
  missing: string[],
): AxisEvidenceComparison["adjustment"] {
  if (kind === "matches_target") {
    return {
      type: "understanding",
      summary: "Raise confidence and keep the target pattern unchanged.",
    };
  }

  if (kind === "missing_evidence") {
    return {
      type: "evidence",
      summary: "Capture the same movement from an angle that shows body, ball, and target together.",
    };
  }

  if (kind === "still_current") {
    return {
      type: "environment",
      summary: "Change the setup so the missing target relationship is visible before the rep starts.",
    };
  }

  return {
    type: "understanding",
    summary: `Update the target comparison around ${missing[0] ?? "the missing pattern"}.`,
  };
}

function hasObservedPattern(observation: AxisObservation): boolean {
  const pattern = observation.updates.currentPattern;
  return Boolean(
    pattern?.label ||
      pattern?.objects?.length ||
      pattern?.relationships?.length ||
      pattern?.motion?.length,
  );
}

function partialToPattern(pattern: Partial<AxisPattern>): AxisPattern {
  return {
    label: pattern.label ?? "",
    objects: pattern.objects ?? [],
    relationships: pattern.relationships ?? [],
    motion: pattern.motion ?? [],
  };
}

function termsFromPattern(pattern: AxisPattern): Set<string> {
  return new Set(
    [
      pattern.label,
      ...pattern.objects,
      ...pattern.relationships,
      ...pattern.motion,
    ]
      .map(normalizeTerm)
      .filter(Boolean),
  );
}

function normalizeTerm(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
