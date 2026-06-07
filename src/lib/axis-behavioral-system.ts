export type AxisBehaviorDomain =
  | "identity"
  | "presence"
  | "participation"
  | "progression"
  | "history"
  | "leaderboard"
  | "return"
  | "replay_memory"
  | "organization"
  | "unknown";

export type AxisBehaviorEvidenceSource =
  | "check_in"
  | "check_out"
  | "session"
  | "upload"
  | "event"
  | "replay"
  | "voice"
  | "note"
  | "tag"
  | "leaderboard"
  | "history"
  | "manual";

export type AxisBehaviorSignal = {
  id: string;
  domain: AxisBehaviorDomain;
  label: string;
  source: AxisBehaviorEvidenceSource;
  confidence: number;
  description?: string;
};

export type AxisBehaviorInference = {
  id: string;
  domain: AxisBehaviorDomain;
  statement: string;
  evidence_signal_ids: string[];
  confidence: number;
  rule: string;
};

export type AxisBehaviorFeedbackLoop = {
  id: string;
  domain: AxisBehaviorDomain;
  trigger: string;
  reinforcement: string;
  expected_return_behavior: string;
  risk?: string;
};

export type AxisLearningValue = {
  horizon: "session" | "week" | "season" | "career";
  value: string;
  depends_on: AxisBehaviorDomain[];
  confidence: number;
};

export type AxisProposedFeature = {
  id: string;
  name: string;
  intent: string;
  domains?: AxisBehaviorDomain[];
  captures?: AxisBehaviorSignal[];
  loses?: AxisBehaviorSignal[];
  infers?: AxisBehaviorInference[];
  feedback_loops?: AxisBehaviorFeedbackLoop[];
  learning_values?: AxisLearningValue[];
  risks?: string[];
};

export type AxisBehavioralFeatureModel = {
  feature_id: string;
  feature_name: string;
  behavior_captured: AxisBehaviorSignal[];
  behavior_lost: AxisBehaviorSignal[];
  behavior_inferred: AxisBehaviorInference[];
  behavioral_feedback_loops: AxisBehaviorFeedbackLoop[];
  long_term_learning_value: AxisLearningValue[];
  understanding_score: number;
  warnings: string[];
};

export type AxisBehavioralSystemModel = {
  features: AxisBehavioralFeatureModel[];
  system_feedback_loops: AxisBehaviorFeedbackLoop[];
  system_learning_value: AxisLearningValue[];
  dominant_domains: AxisBehaviorDomain[];
  warnings: string[];
};

const AXIS_CORE_DOMAINS: AxisBehaviorDomain[] = [
  "identity",
  "presence",
  "participation",
  "progression",
  "history",
  "leaderboard",
  "return",
];

export function evaluateAxisFeatureBehavior(feature: AxisProposedFeature): AxisBehavioralFeatureModel {
  const behaviorCaptured = feature.captures ?? [];
  const behaviorLost = feature.loses ?? [];
  const behaviorInferred = feature.infers ?? [];
  const feedbackLoops = feature.feedback_loops ?? [];
  const learningValues = feature.learning_values ?? [];
  const warnings = buildFeatureWarnings(feature, behaviorCaptured, behaviorLost, behaviorInferred, feedbackLoops);
  const understandingScore = scoreBehavioralUnderstanding({
    captured: behaviorCaptured,
    lost: behaviorLost,
    inferred: behaviorInferred,
    feedbackLoops,
    learningValues,
  });

  return {
    feature_id: feature.id,
    feature_name: feature.name,
    behavior_captured: behaviorCaptured,
    behavior_lost: behaviorLost,
    behavior_inferred: behaviorInferred,
    behavioral_feedback_loops: feedbackLoops,
    long_term_learning_value: learningValues,
    understanding_score: understandingScore,
    warnings,
  };
}

export function buildAxisBehavioralSystem(features: AxisProposedFeature[]): AxisBehavioralSystemModel {
  const featureModels = features.map(evaluateAxisFeatureBehavior);
  const systemFeedbackLoops = mergeFeedbackLoops(featureModels.flatMap((feature) => feature.behavioral_feedback_loops));
  const systemLearningValue = mergeLearningValues(featureModels.flatMap((feature) => feature.long_term_learning_value));
  const dominantDomains = rankDominantDomains(featureModels);
  const warnings = featureModels.flatMap((feature) =>
    feature.warnings.map((warning) => `${feature.feature_name}: ${warning}`),
  );

  return {
    features: featureModels,
    system_feedback_loops: systemFeedbackLoops,
    system_learning_value: systemLearningValue,
    dominant_domains: dominantDomains,
    warnings,
  };
}

export function createBehaviorSignal(input: {
  id: string;
  domain: AxisBehaviorDomain;
  label: string;
  source: AxisBehaviorEvidenceSource;
  confidence?: number;
  description?: string;
}): AxisBehaviorSignal {
  return {
    id: input.id,
    domain: input.domain,
    label: input.label,
    source: input.source,
    confidence: clamp(input.confidence ?? 0.75),
    description: input.description,
  };
}

export function inferBehavior(input: {
  id: string;
  domain: AxisBehaviorDomain;
  statement: string;
  evidence_signal_ids: string[];
  confidence?: number;
  rule: string;
}): AxisBehaviorInference {
  return {
    id: input.id,
    domain: input.domain,
    statement: input.statement,
    evidence_signal_ids: input.evidence_signal_ids,
    confidence: clamp(input.confidence ?? 0.6),
    rule: input.rule,
  };
}

function buildFeatureWarnings(
  feature: AxisProposedFeature,
  captured: AxisBehaviorSignal[],
  lost: AxisBehaviorSignal[],
  inferred: AxisBehaviorInference[],
  feedbackLoops: AxisBehaviorFeedbackLoop[],
) {
  const warnings: string[] = [];
  const domains = new Set([...(feature.domains ?? []), ...captured.map((signal) => signal.domain)]);

  if (captured.length === 0) {
    warnings.push("No captured behavior identified.");
  }

  if (lost.length > captured.length) {
    warnings.push("Feature loses more behavior than it captures.");
  }

  if (inferred.length > 0 && captured.length === 0) {
    warnings.push("Inference exists without direct captured behavior.");
  }

  if (feedbackLoops.length === 0) {
    warnings.push("No behavioral feedback loop identified.");
  }

  if (!hasCoreContinuityDomain(domains)) {
    warnings.push("Feature is not anchored to the Axis continuity loop.");
  }

  for (const risk of feature.risks ?? []) {
    warnings.push(risk);
  }

  return warnings;
}

function scoreBehavioralUnderstanding(input: {
  captured: AxisBehaviorSignal[];
  lost: AxisBehaviorSignal[];
  inferred: AxisBehaviorInference[];
  feedbackLoops: AxisBehaviorFeedbackLoop[];
  learningValues: AxisLearningValue[];
}) {
  const capturedScore = weightedSignalConfidence(input.captured) * 0.35;
  const inferenceScore = weightedInferenceConfidence(input.inferred) * 0.18;
  const feedbackScore = Math.min(1, input.feedbackLoops.length / 2) * 0.22;
  const learningScore = weightedLearningConfidence(input.learningValues) * 0.25;
  const lostPenalty = Math.min(0.35, weightedSignalConfidence(input.lost) * 0.25 + input.lost.length * 0.03);

  return clamp(capturedScore + inferenceScore + feedbackScore + learningScore - lostPenalty);
}

function weightedSignalConfidence(signals: AxisBehaviorSignal[]) {
  if (signals.length === 0) return 0;
  const domainCoverage = new Set(signals.map((signal) => signal.domain)).size;
  const confidenceMean = signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length;
  return clamp(confidenceMean * 0.8 + Math.min(1, domainCoverage / AXIS_CORE_DOMAINS.length) * 0.2);
}

function weightedInferenceConfidence(inferences: AxisBehaviorInference[]) {
  if (inferences.length === 0) return 0;
  return clamp(inferences.reduce((sum, inference) => sum + inference.confidence, 0) / inferences.length);
}

function weightedLearningConfidence(values: AxisLearningValue[]) {
  if (values.length === 0) return 0;
  const horizonWeight: Record<AxisLearningValue["horizon"], number> = {
    session: 0.55,
    week: 0.72,
    season: 0.9,
    career: 1,
  };
  const total = values.reduce((sum, value) => sum + value.confidence * horizonWeight[value.horizon], 0);
  return clamp(total / values.length);
}

function mergeFeedbackLoops(loops: AxisBehaviorFeedbackLoop[]) {
  const byId = new Map<string, AxisBehaviorFeedbackLoop>();
  for (const loop of loops) {
    byId.set(loop.id, loop);
  }
  return [...byId.values()];
}

function mergeLearningValues(values: AxisLearningValue[]) {
  const byKey = new Map<string, AxisLearningValue>();
  for (const value of values) {
    byKey.set(`${value.horizon}:${value.value}`, value);
  }
  return [...byKey.values()];
}

function rankDominantDomains(features: AxisBehavioralFeatureModel[]) {
  const counts = new Map<AxisBehaviorDomain, number>();
  for (const feature of features) {
    for (const signal of feature.behavior_captured) {
      counts.set(signal.domain, (counts.get(signal.domain) ?? 0) + 2);
    }
    for (const loop of feature.behavioral_feedback_loops) {
      counts.set(loop.domain, (counts.get(loop.domain) ?? 0) + 1);
    }
    for (const inference of feature.behavior_inferred) {
      counts.set(inference.domain, (counts.get(inference.domain) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain]) => domain);
}

function hasCoreContinuityDomain(domains: Set<AxisBehaviorDomain>) {
  return AXIS_CORE_DOMAINS.some((domain) => domains.has(domain));
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
