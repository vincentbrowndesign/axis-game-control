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
    return {
      confidence: 0.9,
      leveragePoint: known.leveragePoint,
      mentalModel: known.mentalModel,
      commonMistake: known.commonMistake,
      experimentCandidate: buildExperimentFromRegistry(known.leveragePoint),
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
  return "Apply this. 90 seconds.";
}

function normalizeOutput(data: Partial<UnderstandingOutput>, intent: string): UnderstandingOutput {
  return {
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
}

function fallback(intent: string): UnderstandingOutput {
  return {
    confidence: 0.3,
    leveragePoint: `The constraint hiding inside "${intent}"`,
    mentalModel: "What would change if you already had this?",
    experimentCandidate: `${intent}. 90 seconds.`,
    clarificationQuestion: `What's the hardest moment inside this?`,
  };
}
