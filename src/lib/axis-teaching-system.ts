import type { AxisBehaviorDomain } from "./axis-behavioral-system";
import type { AxisTraceableClaim } from "./axis-evidence-engine";

export type AxisTeachingLevel = "foundation" | "repeatable" | "advanced";

export type AxisTeachingEvidence = {
  claim_id: string;
  claim: string;
  source: string;
  confidence: number;
  confidence_level: AxisTraceableClaim["confidence_level"];
  supporting_evidence_ids: string[];
  contradictory_evidence_ids: string[];
  missing_evidence_ids: string[];
};

export type AxisTeachingExplanation = {
  summary: string;
  why_it_matters: string;
  retention_cue: string;
};

export type AxisTeachingCorrection = {
  focus: string;
  action: string;
  avoid: string;
};

export type AxisTeachingDrill = {
  name: string;
  setup: string;
  reps: string;
  success_signal: string;
};

export type AxisTeachingProgression = {
  level: AxisTeachingLevel;
  next_step: string;
  unlock_condition: string;
};

export type AxisTeachingInsight = {
  id: string;
  domain: AxisBehaviorDomain;
  evidence: AxisTeachingEvidence;
  explanation: AxisTeachingExplanation;
  correction: AxisTeachingCorrection;
  drill: AxisTeachingDrill;
  progression: AxisTeachingProgression;
  retention_score: number;
};

export type AxisTeachingPlan = {
  insights: AxisTeachingInsight[];
  blocked_claim_ids: string[];
};

export type AxisTeachingOptions = {
  default_domain?: AxisBehaviorDomain;
  max_insights?: number;
};

export function buildAxisTeachingPlan(
  claims: AxisTraceableClaim[],
  options: AxisTeachingOptions = {},
): AxisTeachingPlan {
  const teachableClaims = claims.filter((claim) => claim.allowed);
  const insights = teachableClaims
    .map((claim) => buildTeachingInsight(claim, options.default_domain ?? "participation"))
    .sort((a, b) => b.retention_score - a.retention_score)
    .slice(0, options.max_insights ?? teachableClaims.length);

  return {
    insights,
    blocked_claim_ids: claims.filter((claim) => !claim.allowed).map((claim) => claim.id),
  };
}

export function buildTeachingInsight(
  claim: AxisTraceableClaim,
  defaultDomain: AxisBehaviorDomain = "participation",
): AxisTeachingInsight {
  const domain = inferTeachingDomain(claim, defaultDomain);
  const evidence = summarizeTeachingEvidence(claim);
  const explanation = buildExplanation(claim, domain);
  const correction = buildCorrection(claim, domain);
  const drill = buildDrill(claim, domain);
  const progression = buildProgression(claim, domain);

  return {
    id: `teaching:${claim.id}`,
    domain,
    evidence,
    explanation,
    correction,
    drill,
    progression,
    retention_score: scoreRetention(claim, explanation, drill, progression),
  };
}

function summarizeTeachingEvidence(claim: AxisTraceableClaim): AxisTeachingEvidence {
  return {
    claim_id: claim.id,
    claim: claim.claim,
    source: claim.source,
    confidence: claim.confidence,
    confidence_level: claim.confidence_level,
    supporting_evidence_ids: claim.supporting_evidence.map((item) => item.evidence_id),
    contradictory_evidence_ids: claim.contradictory_evidence.map((item) => item.evidence_id),
    missing_evidence_ids: claim.missing_evidence.map((item) => item.id),
  };
}

function buildExplanation(claim: AxisTraceableClaim, domain: AxisBehaviorDomain): AxisTeachingExplanation {
  return {
    summary: claim.claim,
    why_it_matters: explainWhyItMatters(domain, claim),
    retention_cue: buildRetentionCue(claim, domain),
  };
}

function buildCorrection(claim: AxisTraceableClaim, domain: AxisBehaviorDomain): AxisTeachingCorrection {
  const contestedPrefix = claim.status === "contested" ? "Verify the moment first, then " : "";

  return {
    focus: focusForDomain(domain),
    action: `${contestedPrefix}${actionForDomain(domain)}`,
    avoid: avoidForDomain(domain),
  };
}

function buildDrill(claim: AxisTraceableClaim, domain: AxisBehaviorDomain): AxisTeachingDrill {
  return {
    name: drillNameForDomain(domain),
    setup: drillSetupForDomain(domain),
    reps: claim.confidence_level === "high" ? "3 clean rounds" : "2 short rounds, then review the moment again",
    success_signal: successSignalForDomain(domain),
  };
}

function buildProgression(claim: AxisTraceableClaim, domain: AxisBehaviorDomain): AxisTeachingProgression {
  const level = claim.confidence_level === "high" ? "repeatable" : "foundation";

  return {
    level,
    next_step: nextStepForDomain(domain),
    unlock_condition:
      claim.status === "contested"
        ? "Repeat after the missing or contradictory evidence is resolved."
        : unlockConditionForDomain(domain),
  };
}

function inferTeachingDomain(claim: AxisTraceableClaim, fallback: AxisBehaviorDomain): AxisBehaviorDomain {
  const text = `${claim.claim} ${claim.source}`.toLowerCase();
  if (text.includes("check") || text.includes("show")) return "presence";
  if (text.includes("streak") || text.includes("return")) return "return";
  if (text.includes("history") || text.includes("archive") || text.includes("replay")) return "history";
  if (text.includes("leaderboard")) return "leaderboard";
  if (text.includes("progress")) return "progression";
  if (text.includes("session") || text.includes("participat") || text.includes("rep")) return "participation";
  return fallback;
}

function explainWhyItMatters(domain: AxisBehaviorDomain, claim: AxisTraceableClaim) {
  const uncertainty =
    claim.status === "contested" ? " The evidence is contested, so the lesson should stay provisional." : "";

  switch (domain) {
    case "presence":
      return `Presence is the start of the Axis loop; this observation affects whether the athlete actually showed up.${uncertainty}`;
    case "participation":
      return `Participation is proof of effort; this observation can become a repeatable session behavior.${uncertainty}`;
    case "progression":
      return `Progression makes the work visible over time; this observation helps define what should improve next.${uncertainty}`;
    case "history":
    case "replay_memory":
      return `History turns the moment into athletic memory; this observation should be attached to the replay record.${uncertainty}`;
    case "leaderboard":
      return `Leaderboard movement only matters when it reflects real participation; this observation explains the behavior behind the change.${uncertainty}`;
    case "return":
      return `Return behavior is the long-term win; this observation should create a reason to come back tomorrow.${uncertainty}`;
    default:
      return `This observation is teachable only because it is tied to evidence.${uncertainty}`;
  }
}

function buildRetentionCue(claim: AxisTraceableClaim, domain: AxisBehaviorDomain) {
  const cue = {
    identity: "Know who owns the moment.",
    presence: "Show up first.",
    participation: "Repeat the effort cleanly.",
    progression: "Make the next rep easier to recognize.",
    history: "Save the moment, then compare it.",
    leaderboard: "Let the board reflect the habit.",
    return: "Leave one clear reason to come back.",
    replay_memory: "Replay the proof, not the noise.",
    organization: "Keep the group record intact.",
    unknown: "Keep the claim tied to evidence.",
  } satisfies Record<AxisBehaviorDomain, string>;

  return claim.status === "contested" ? `${cue[domain]} Verify before teaching.` : cue[domain];
}

function focusForDomain(domain: AxisBehaviorDomain) {
  switch (domain) {
    case "presence":
      return "arrival rhythm";
    case "participation":
      return "repeatable effort";
    case "progression":
      return "one visible improvement";
    case "history":
    case "replay_memory":
      return "memory quality";
    case "leaderboard":
      return "habit behind rank";
    case "return":
      return "tomorrow trigger";
    default:
      return "evidence-backed behavior";
  }
}

function actionForDomain(domain: AxisBehaviorDomain) {
  switch (domain) {
    case "presence":
      return "anchor the next session with a clean check-in before any activity.";
    case "participation":
      return "repeat the observed action slowly until the same behavior is visible again.";
    case "progression":
      return "choose one part of the behavior to improve in the next session.";
    case "history":
    case "replay_memory":
      return "save the moment and compare it to the next similar moment.";
    case "leaderboard":
      return "connect the board movement to the session behavior that caused it.";
    case "return":
      return "end with one small target for tomorrow.";
    default:
      return "review the evidence, name the behavior, and repeat it.";
  }
}

function avoidForDomain(domain: AxisBehaviorDomain) {
  switch (domain) {
    case "presence":
      return "counting activity that was not checked in.";
    case "participation":
      return "turning one observed rep into a broad claim.";
    case "progression":
      return "tracking too many corrections at once.";
    case "history":
    case "replay_memory":
      return "saving unsupported memory as fact.";
    case "leaderboard":
      return "treating rank as the lesson.";
    case "return":
      return "ending without a next action.";
    default:
      return "teaching beyond the evidence.";
  }
}

function drillNameForDomain(domain: AxisBehaviorDomain) {
  switch (domain) {
    case "presence":
      return "Check-in reset";
    case "participation":
      return "Repeat-the-proof reps";
    case "progression":
      return "One-change ladder";
    case "history":
    case "replay_memory":
      return "Replay compare";
    case "leaderboard":
      return "Habit-to-board review";
    case "return":
      return "Tomorrow target";
    default:
      return "Evidence replay";
  }
}

function drillSetupForDomain(domain: AxisBehaviorDomain) {
  switch (domain) {
    case "presence":
      return "Start at the session entry point and complete the same check-in ritual.";
    case "participation":
      return "Use the saved moment as the reference, then repeat the same behavior at low speed.";
    case "progression":
      return "Pick one correction and run it through an easy, medium, and normal-speed rep.";
    case "history":
    case "replay_memory":
      return "Watch the current moment beside the closest previous moment.";
    case "leaderboard":
      return "Review the session behavior that caused the leaderboard movement.";
    case "return":
      return "Write or save one target that can be completed next session.";
    default:
      return "Open the supporting evidence and replay the behavior.";
  }
}

function successSignalForDomain(domain: AxisBehaviorDomain) {
  switch (domain) {
    case "presence":
      return "The session starts with a clean presence record.";
    case "participation":
      return "The same behavior is visible again without extra prompting.";
    case "progression":
      return "The next rep shows the selected correction.";
    case "history":
    case "replay_memory":
      return "The new moment can be compared to the old one.";
    case "leaderboard":
      return "The athlete can name the behavior behind the movement.";
    case "return":
      return "The next session has a clear first action.";
    default:
      return "The evidence still supports the lesson after review.";
  }
}

function nextStepForDomain(domain: AxisBehaviorDomain) {
  switch (domain) {
    case "presence":
      return "Make the check-in repeatable across the next three sessions.";
    case "participation":
      return "Capture the same behavior again and compare consistency.";
    case "progression":
      return "Move from one corrected rep to a short sequence.";
    case "history":
    case "replay_memory":
      return "Attach the moment to session history for future comparison.";
    case "leaderboard":
      return "Connect the next leaderboard change to a saved behavior.";
    case "return":
      return "Use the target as the first action tomorrow.";
    default:
      return "Collect stronger evidence before advancing.";
  }
}

function unlockConditionForDomain(domain: AxisBehaviorDomain) {
  switch (domain) {
    case "presence":
      return "Three clean check-ins in a row.";
    case "participation":
      return "Two matching moments with supporting evidence.";
    case "progression":
      return "The correction appears in a later session.";
    case "history":
    case "replay_memory":
      return "A comparable moment exists in history.";
    case "leaderboard":
      return "The athlete can connect rank movement to effort.";
    case "return":
      return "The athlete returns and completes the saved target.";
    default:
      return "Confidence reaches medium or high with no unresolved contradiction.";
  }
}

function scoreRetention(
  claim: AxisTraceableClaim,
  explanation: AxisTeachingExplanation,
  drill: AxisTeachingDrill,
  progression: AxisTeachingProgression,
) {
  const evidenceScore = claim.confidence * 0.35;
  const contradictionPenalty = Math.min(0.2, claim.contradictory_evidence.length * 0.08);
  const missingPenalty = Math.min(0.2, claim.missing_evidence.length * 0.06);
  const structureScore =
    (Boolean(explanation.retention_cue) ? 0.18 : 0) +
    (Boolean(drill.success_signal) ? 0.22 : 0) +
    (Boolean(progression.unlock_condition) ? 0.25 : 0);

  return clamp(evidenceScore + structureScore - contradictionPenalty - missingPenalty);
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
