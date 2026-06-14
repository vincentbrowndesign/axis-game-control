// ---------------------------------------------------------------------------
// Understanding Engine
//
// Position in the loop:
//   Intent → Understand → Experiment
//                ^^^
//
// Input:  raw human intent
// Output: leverage point, mental model, experiment candidate
//
// The engine tries the registry first (fast, offline).
// If the registry has no match, it calls OpenAI (slower, richer).
// If OpenAI is unavailable, it falls back to a structured reflection.
//
// OpenAI's job here: find leverage points and mental models.
// Not: essays, coaching, long explanations.
// ---------------------------------------------------------------------------

import { findEntry } from "./understanding-registry";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UnderstandingInput {
  intent: string;
  context?: string;
  threadHistory?: string[];
}

export interface UnderstandingOutput {
  confidence: number;
  leveragePoint: string;
  mentalModel: string;
  commonMistake?: string;
  experimentCandidate: string;
  clarificationQuestion?: string;
  insights: InsightObject[];
}

export interface InsightObject {
  id: string;
  title: string;
  insight: string;
  mentalModel?: string;
  experimentCandidate?: string;
}

// ---------------------------------------------------------------------------
// API call — OpenAI finds the leverage point
// ---------------------------------------------------------------------------

export async function understand(
  input: UnderstandingInput,
  signal?: AbortSignal,
): Promise<UnderstandingOutput> {
  // Registry first — instant, no latency
  const known = findEntry(input.intent);
  if (known) {
    const experimentCandidate = buildExperimentFromRegistry(known.leveragePoint);
    return {
      confidence: 0.9,
      leveragePoint: known.leveragePoint,
      mentalModel: known.mentalModel,
      commonMistake: known.commonMistake,
      experimentCandidate,
      insights: [
        createInsightObject({
          id: known.id,
          leveragePoint: known.leveragePoint,
          mentalModel: known.mentalModel,
          experimentCandidate,
        }),
      ],
    };
  }

  // LLM path — calls /api/axis/understand
  try {
    const res = await fetch("/api/axis/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });

    if (!res.ok) throw new Error("understand api error");

    const data = await res.json() as Partial<UnderstandingOutput>;
    return normalizeOutput(data, input.intent);
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    // Fallback — structured reflection, no LLM
    return fallback(input.intent);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildExperimentFromRegistry(leveragePoint: string): string {
  // Strip to imperative form — "Waiting for information" → "Create information first"
  // This is intentionally simple. The LLM path produces richer candidates.
  if (leveragePoint.toLowerCase().includes("waiting")) return "Create a reaction before attacking. 90 seconds.";
  if (leveragePoint.toLowerCase().includes("ball")) return "Eyes up. No ball contact. 90 seconds.";
  if (leveragePoint.toLowerCase().includes("contact")) return "Finish through contact. 90 seconds.";
  if (leveragePoint.toLowerCase().includes("deciding")) return "Know before you catch. 90 seconds.";
  if (leveragePoint.toLowerCase().includes("reacting")) return "Watch the hips. 90 seconds.";
  if (leveragePoint.toLowerCase().includes("last thing") && leveragePoint.toLowerCase().includes("breaks")) {
    return "Set your base before release. 90 seconds.";
  }
  if (leveragePoint.toLowerCase().includes("place to be seen")) return "Create a passing signal before you cut. 90 seconds.";
  return "Apply this. 90 seconds.";
}

function createInsightObject(input: {
  id?: string;
  leveragePoint: string;
  mentalModel?: string;
  experimentCandidate?: string;
}): InsightObject {
  return {
    id: input.id ?? `insight-${slugFromText(input.leveragePoint)}`,
    title: titleFromLeveragePoint(input.leveragePoint),
    insight: input.leveragePoint,
    mentalModel: input.mentalModel,
    experimentCandidate: input.experimentCandidate,
  };
}

function titleFromLeveragePoint(leveragePoint: string): string {
  const lower = leveragePoint.toLowerCase();
  if (lower.includes("waiting for information")) return "Waiting For Information";
  if (lower.includes("last thing") && lower.includes("breaks")) return "Foundation Before Release";
  if (lower.includes("manage the ball")) return "Dribble To Create";
  if (lower.includes("deciding before")) return "Decide Before Receiving";
  if (lower.includes("reacting to the ball")) return "Read The Body";
  if (lower.includes("place to be seen")) return "Create A Signal";
  if (lower.includes("contact")) return "Use The Contact";
  return leveragePoint
    .replace(/[.?!]+$/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function slugFromText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || Date.now().toString(36);
}

function normalizeOutput(data: Partial<UnderstandingOutput>, intent: string): UnderstandingOutput {
  const output = {
    confidence: typeof data.confidence === "number" ? Math.min(1, Math.max(0, data.confidence)) : 0.5,
    leveragePoint: typeof data.leveragePoint === "string" && data.leveragePoint.trim()
      ? data.leveragePoint.trim()
      : `The real constraint inside "${intent}"`,
    mentalModel: typeof data.mentalModel === "string" && data.mentalModel.trim()
      ? data.mentalModel.trim()
      : "What would change if the constraint was already satisfied?",
    commonMistake: typeof data.commonMistake === "string" && data.commonMistake.trim()
      ? data.commonMistake.trim()
      : undefined,
    experimentCandidate: typeof data.experimentCandidate === "string" && data.experimentCandidate.trim()
      ? data.experimentCandidate.trim()
      : `Work on ${intent}. 90 seconds.`,
    clarificationQuestion: typeof data.clarificationQuestion === "string" && data.clarificationQuestion.trim()
      ? data.clarificationQuestion.trim()
      : undefined,
  };
  return {
    ...output,
    insights: Array.isArray(data.insights) && data.insights.length > 0
      ? data.insights.map((insight, index) => normalizeInsightObject(insight, index, output))
      : [createInsightObject(output)],
  };
}

function normalizeInsightObject(
  insight: Partial<InsightObject>,
  index: number,
  fallbackOutput: Omit<UnderstandingOutput, "insights">,
): InsightObject {
  const fallback = createInsightObject(fallbackOutput);
  return {
    id: typeof insight.id === "string" && insight.id.trim() ? insight.id.trim() : `${fallback.id}-${index}`,
    title: typeof insight.title === "string" && insight.title.trim() ? insight.title.trim() : fallback.title,
    insight: typeof insight.insight === "string" && insight.insight.trim() ? insight.insight.trim() : fallback.insight,
    mentalModel: typeof insight.mentalModel === "string" && insight.mentalModel.trim()
      ? insight.mentalModel.trim()
      : fallback.mentalModel,
    experimentCandidate: typeof insight.experimentCandidate === "string" && insight.experimentCandidate.trim()
      ? insight.experimentCandidate.trim()
      : fallback.experimentCandidate,
  };
}

function fallback(intent: string): UnderstandingOutput {
  const output = {
    confidence: 0.3,
    leveragePoint: `The constraint hiding inside "${intent}"`,
    mentalModel: "What would change if you already had this?",
    experimentCandidate: `${intent}. 90 seconds.`,
    clarificationQuestion: `What's the hardest moment inside this?`,
  };
  return { ...output, insights: [createInsightObject(output)] };
}
