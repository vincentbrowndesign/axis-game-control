import OpenAI from "openai";
import type { AxisMomentCandidate, AxisVisionRead } from "../core/types";

export type AxisMomentInterpretationInput = {
  note?: string;
  sessionContext?: string;
  visionRead: AxisVisionRead;
};

type CandidatePayload = Partial<Omit<AxisMomentCandidate, "evidenceIds" | "id" | "sessionId" | "timestampMs">>;

export async function interpretAxisMomentCandidate(input: AxisMomentInterpretationInput): Promise<AxisMomentCandidate> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackMomentCandidate(input, "uncertain");

  const compactRead = compactVisionRead(input.visionRead);
  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.responses.create({
      input: [
        {
          content: [
            {
              text: [
                "You interpret basketball vision reads into structured Axis memory.",
                "Use only the supplied detected objects, motion hints, timestamp, session context, and optional note.",
                "Return JSON only.",
                "Primary structure must be Situation, Actor, Action, Outcome, Cause, Correction, Evidence.",
                "Do not use vague labels like good rep, bad rep, make, miss, or score as the main structure.",
                "Never claim make/miss without ball and rim evidence.",
                "Never claim shot attempt without player, ball, and rim motion evidence.",
                "If evidence is incomplete, mark reviewState as uncertain or needs_review.",
              ].join(" "),
              type: "input_text",
            },
            {
              text: JSON.stringify({
                note: input.note ?? "",
                sessionContext: input.sessionContext ?? "",
                visionRead: compactRead,
              }),
              type: "input_text",
            },
          ],
          role: "user",
        },
      ],
      max_output_tokens: 500,
      model: process.env.AXIS_MOMENT_MODEL || "gpt-4.1-mini",
      text: {
        format: {
          name: "axis_moment_candidate",
          schema: {
            additionalProperties: false,
            properties: {
              action: { type: "string" },
              actor: { type: "string" },
              cause: { type: "string" },
              correction: { type: "string" },
              outcome: { type: "string" },
              reviewState: { enum: ["ready", "needs_review", "uncertain"], type: "string" },
              situation: { type: "string" },
              title: { type: "string" },
            },
            required: ["title", "reviewState"],
            type: "object",
          },
          strict: false,
          type: "json_schema",
        },
      },
    });

    const raw = response.output_text || "{}";
    const parsed = JSON.parse(raw) as CandidatePayload;
    return normalizeMomentCandidate(input, parsed);
  } catch {
    return fallbackMomentCandidate(input, confidenceToReviewState(input.visionRead.confidence));
  }
}

function normalizeMomentCandidate(input: AxisMomentInterpretationInput, payload: CandidatePayload): AxisMomentCandidate {
  const reviewState = payload.reviewState === "ready" || payload.reviewState === "needs_review" || payload.reviewState === "uncertain"
    ? payload.reviewState
    : confidenceToReviewState(input.visionRead.confidence);

  return {
    action: clean(payload.action),
    actor: clean(payload.actor),
    cause: clean(payload.cause),
    correction: clean(payload.correction),
    evidenceIds: [`axis-evidence-${input.visionRead.id}`],
    id: `axis-moment-${crypto.randomUUID()}`,
    outcome: clean(payload.outcome),
    reviewState,
    sessionId: input.visionRead.sessionId,
    situation: clean(payload.situation),
    timestampMs: input.visionRead.timestampMs,
    title: clean(payload.title) || fallbackTitle(input.visionRead),
  };
}

function fallbackMomentCandidate(input: AxisMomentInterpretationInput, reviewState: AxisMomentCandidate["reviewState"]): AxisMomentCandidate {
  const read = input.visionRead;
  return {
    actor: read.objects.some((object) => object.kind === "player") ? "Player" : undefined,
      action: read.motionHints.map((hint) => hint.summary).join(", ") || "Moment marked",
    evidenceIds: [`axis-evidence-${read.id}`],
    id: `axis-moment-${crypto.randomUUID()}`,
    reviewState,
    sessionId: read.sessionId,
    situation: input.note || "Marked camera moment",
    timestampMs: read.timestampMs,
    title: fallbackTitle(read),
  };
}

function fallbackTitle(read: AxisVisionRead) {
  const labels = read.objects.map((object) => object.label);
  return labels.length ? `Marked: ${labels.join(" / ")}` : "Marked moment";
}

function confidenceToReviewState(confidence: number): AxisMomentCandidate["reviewState"] {
  if (confidence >= 0.78) return "ready";
  if (confidence >= 0.45) return "needs_review";
  return "uncertain";
}

function compactVisionRead(read: AxisVisionRead) {
  return {
    confidence: read.confidence,
    objects: read.objects.map((object) => ({
      box: object.box,
      confidence: object.confidence,
      kind: object.kind,
      point: object.point,
    })),
    reviewState: read.reviewState,
    source: read.source,
    timestampMs: read.timestampMs,
    motionHints: read.motionHints,
  };
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 180) : undefined;
}
