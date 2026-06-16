import type { AxisObservation, AxisPattern, AxisUnderstanding } from "./axis-server";
import {
  AXIS_MOVEMENT_PRIMITIVE_TEXT,
  filterAxisMovementPrimitives,
} from "./axis-movement-language";

const SYSTEM_OBSERVE = `You are Axis's eyes. Eyes do not generate output. Eyes update understanding.

Look only for movement-relevant signal: ${AXIS_MOVEMENT_PRIMITIVE_TEXT}.

Ignore everything else: gym background, jerseys, audience, walls, colors, branding, lighting, camera shake, decorative detail. Do not mention these.

You will be given the current belief and its confidence. Compare what you see against that belief. Your job is to report whether this image confirms, contradicts, or sharpens it - not to describe the scene.

JSON only. No markdown. No explanation outside the schema.

Schema:
{"summary":"one sentence, what this evidence shows that matters","relevantSignals":["..."],"ignoredNoise":["..."],"updates":{"concept":"...","belief":"...","confidenceDelta":0.15,"currentPattern":{"label":"...","objects":["..."],"relationships":["..."],"motion":["..."]},"targetPattern":{"label":"...","objects":["..."],"relationships":["..."],"motion":["..."]}}}

Rules:
- confidenceDelta is between -0.3 and 0.3. Positive when the evidence confirms the belief. Negative when it contradicts it.
- Omit any field in "updates" you have no evidence for. Do not invent values.
- Only set "belief" if the evidence changes or sharpens the wording of the belief. Otherwise omit it.
- currentPattern/targetPattern are partial - include only the keys you have direct evidence for.`;

export interface ObserveEvidenceInput {
  apiKey?: string;
  evidenceUrl?: string;
  evidenceType?: string;
  message?: string;
  prior: AxisUnderstanding;
}

export interface ObservationLearningResult {
  understanding: AxisUnderstanding;
  appliedObservationCount: number;
  confidenceDelta: number;
}

const EMPTY_OBSERVATION_UPDATES: AxisObservation["updates"] = {};

export function observationSourceFromType(type: string): AxisObservation["source"] {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/") || type === "voice") return "voice";
  return "document";
}

export function parseAxisObservation(
  raw: string,
  source: AxisObservation["source"],
): AxisObservation {
  const empty: AxisObservation = {
    source,
    summary: "",
    relevantSignals: [],
    ignoredNoise: [],
    updates: EMPTY_OBSERVATION_UPDATES,
  };

  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const p = JSON.parse(slice) as Record<string, unknown>;

    const strArr = (v: unknown): string[] =>
      Array.isArray(v)
        ? (v as unknown[]).flatMap((x) => (typeof x === "string" && x.trim() ? [x.trim()] : []))
        : [];

    const parsePartialPattern = (v: unknown): Partial<AxisPattern> | undefined => {
      if (!v || typeof v !== "object") return undefined;
      const d = v as Record<string, unknown>;
      const patch: Partial<AxisPattern> = {};
      if (typeof d.label === "string" && d.label.trim()) patch.label = d.label.trim();
      const objects = strArr(d.objects);
      if (objects.length) patch.objects = objects;
      const relationships = strArr(d.relationships);
      if (relationships.length) patch.relationships = relationships;
      const motion = strArr(d.motion);
      if (motion.length) patch.motion = motion;
      return Object.keys(patch).length > 0 ? patch : undefined;
    };

    const updates = (
      p.updates && typeof p.updates === "object" ? p.updates : {}
    ) as Record<string, unknown>;

    return {
      source,
      summary: typeof p.summary === "string" ? p.summary.trim() : "",
      relevantSignals: filterAxisMovementPrimitives(strArr(p.relevantSignals)),
      ignoredNoise: strArr(p.ignoredNoise),
      updates: {
        concept:
          typeof updates.concept === "string" && updates.concept.trim()
            ? updates.concept.trim()
            : undefined,
        belief:
          typeof updates.belief === "string" && updates.belief.trim()
            ? updates.belief.trim()
            : undefined,
        confidenceDelta:
          typeof updates.confidenceDelta === "number"
            ? Math.min(0.3, Math.max(-0.3, updates.confidenceDelta))
            : undefined,
        currentPattern: parsePartialPattern(updates.currentPattern),
        targetPattern: parsePartialPattern(updates.targetPattern),
      },
    };
  } catch {
    return empty;
  }
}

export function mergeObservationIntoUnderstanding(
  prior: AxisUnderstanding,
  observation: AxisObservation,
): AxisUnderstanding {
  const { updates } = observation;

  const mergePattern = (base: AxisPattern, patch?: Partial<AxisPattern>): AxisPattern =>
    patch
      ? {
          label: patch.label ?? base.label,
          objects: patch.objects ?? base.objects,
          relationships: patch.relationships ?? base.relationships,
          motion: patch.motion ?? base.motion,
        }
      : base;

  return {
    ...prior,
    concept: updates.concept ?? prior.concept,
    belief: updates.belief ?? prior.belief,
    confidence: Math.min(1, Math.max(0, prior.confidence + (updates.confidenceDelta ?? 0))),
    currentPattern: mergePattern(prior.currentPattern, updates.currentPattern),
    targetPattern: mergePattern(prior.targetPattern, updates.targetPattern),
  };
}

export function updateUnderstandingFromObservation(
  prior: AxisUnderstanding,
  observation: AxisObservation,
): ObservationLearningResult {
  return updateUnderstandingFromObservations(prior, [observation]);
}

export function updateUnderstandingFromObservations(
  prior: AxisUnderstanding,
  observations: AxisObservation[],
): ObservationLearningResult {
  let understanding = prior;
  let confidenceDelta = 0;
  let appliedObservationCount = 0;

  for (const observation of observations) {
    if (!hasObservationSignal(observation)) continue;

    const delta = confidenceDeltaFromObservation(understanding, observation);
    const adjustedObservation: AxisObservation = {
      ...observation,
      updates: {
        ...observation.updates,
        confidenceDelta: delta,
      },
    };

    understanding = mergeObservationIntoUnderstanding(understanding, adjustedObservation);
    confidenceDelta += delta;
    appliedObservationCount += 1;
  }

  return {
    understanding,
    appliedObservationCount,
    confidenceDelta: clampConfidenceDelta(confidenceDelta, -1, 1),
  };
}

export function hasObservationSignal(observation: AxisObservation): boolean {
  return Boolean(
    observation.summary ||
      observation.relevantSignals.length ||
      observation.updates.concept ||
      observation.updates.belief ||
      observation.updates.currentPattern ||
      observation.updates.targetPattern ||
      typeof observation.updates.confidenceDelta === "number",
  );
}

function confidenceDeltaFromObservation(
  prior: AxisUnderstanding,
  observation: AxisObservation,
): number {
  if (typeof observation.updates.confidenceDelta === "number") {
    return clampConfidenceDelta(observation.updates.confidenceDelta, -0.3, 0.3);
  }

  const priorBelief = normalizeText(prior.belief);
  const observedBelief = normalizeText(observation.updates.belief);

  if (observedBelief && priorBelief && observedBelief !== priorBelief) return -0.08;
  if (observedBelief && priorBelief && observedBelief === priorBelief) return 0.06;

  const patternContradicts =
    contradictsPattern(prior.currentPattern, observation.updates.currentPattern) ||
    contradictsPattern(prior.targetPattern, observation.updates.targetPattern);
  if (patternContradicts) return -0.06;

  if (observation.relevantSignals.length || observation.updates.currentPattern || observation.updates.targetPattern) {
    return 0.04;
  }

  return 0;
}

function contradictsPattern(base: AxisPattern, patch?: Partial<AxisPattern>): boolean {
  if (!patch) return false;

  if (patch.label && base.label && normalizeText(patch.label) !== normalizeText(base.label)) return true;

  const baseMotion = new Set(base.motion.map(normalizeText));
  const patchMotion = (patch.motion ?? []).map(normalizeText);
  return patchMotion.some((motion) => baseMotion.size > 0 && !baseMotion.has(motion));
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function clampConfidenceDelta(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function observeEvidence(input: ObserveEvidenceInput): Promise<AxisObservation> {
  const evidenceType = input.evidenceType ?? "";
  const source = observationSourceFromType(evidenceType);

  if (source !== "image" || !input.evidenceUrl || !input.apiKey) {
    return {
      source,
      summary:
        source === "voice"
          ? "Voice evidence received and logged without extracting movement detail."
          : "Evidence received and logged without extracting movement detail.",
      relevantSignals: [],
      ignoredNoise: [],
      updates: {},
    };
  }

  const priorContext = input.prior.belief
    ? `Current belief: "${input.prior.belief}" (confidence: ${input.prior.confidence}).`
    : "No prior belief established yet.";

  const userText = [
    priorContext,
    input.message ? `Player/coach message: "${input.message}"` : null,
    "Look at the image and report only what updates the belief above.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: SYSTEM_OBSERVE,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: input.evidenceUrl } },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[axis/observation] observe error", res.status);
      return { source: "image", summary: "", relevantSignals: [], ignoredNoise: [], updates: {} };
    }

    const raw = (await res.json()) as { content?: Array<{ type: string; text: string }> };
    const text = raw.content?.find((c) => c.type === "text")?.text ?? "{}";
    return parseAxisObservation(text, "image");
  } catch (err) {
    console.error("[axis/observation] observe fetch error", (err as Error).message);
    return { source: "image", summary: "", relevantSignals: [], ignoredNoise: [], updates: {} };
  }
}

// ---------------------------------------------------------------------------
// Text observation — extract AxisObservation from a manual report.
// Observation only: no coaching, no experiments, no interpretation.
// If the text contains no observable physical facts, returns an empty observation.
// ---------------------------------------------------------------------------

const SYSTEM_OBSERVE_TEXT = `You are Axis's observation layer for text reports.

Your only job is to extract physical facts that were directly observed — objects, spatial relationships, and motion states. Do not interpret, advise, generate experiments, or create coaching cues.

If the text is a question, a goal statement, a request for help, or contains no observable physical facts, return an empty object: {}

JSON only. No markdown. No explanation.

Schema:
{"summary":"one sentence stating what was physically observed","relevantSignals":["movement primitives that apply"],"ignoredNoise":[],"updates":{"belief":"new or sharpened belief statement if observation clearly changes it","confidenceDelta":0.0,"currentPattern":{"label":"...","objects":["..."],"relationships":["..."],"motion":["..."]}}}

Rules:
- Only set fields you have direct evidence for from the text.
- confidenceDelta: positive (0 to 0.2) if observation confirms prior belief, negative (-0.2 to 0) if it contradicts.
- If the text has no observable movement facts, return {}.`;

export interface ObserveTextReportInput {
  apiKey?: string;
  message: string;
  prior: AxisUnderstanding;
}

export async function observeTextReport(input: ObserveTextReportInput): Promise<AxisObservation> {
  const empty: AxisObservation = {
    source: "document",
    summary: "",
    relevantSignals: [],
    ignoredNoise: [],
    updates: {},
  };

  if (!input.apiKey || !input.message.trim()) return empty;

  const priorContext = input.prior.belief
    ? `Current belief: "${input.prior.belief}" (confidence: ${input.prior.confidence}).`
    : "No prior belief established yet.";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_OBSERVE_TEXT,
        messages: [
          {
            role: "user",
            content: `${priorContext}\n\nReport: "${input.message}"`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[axis/observation] text observe error", res.status);
      return empty;
    }

    const raw = (await res.json()) as { content?: Array<{ type: string; text: string }> };
    const text = raw.content?.find((c) => c.type === "text")?.text ?? "{}";
    return parseAxisObservation(text, "document");
  } catch (err) {
    console.error("[axis/observation] text observe fetch error", (err as Error).message);
    return empty;
  }
}
