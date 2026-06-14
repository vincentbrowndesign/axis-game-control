export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Insight Engine
//
// Input:  { intent, evidence?, witnessClaims?, context?, threadHistory? }
// Output: { insight, confidence, reasoning, nextRequiredCard,
//           mentalModel?, experimentCandidate?, witnessPrompt?,
//           clarificationQuestion? }
//
// Job: identify the highest-leverage observation. Not solve the problem.
// ---------------------------------------------------------------------------

interface UnderstandRequest {
  intent: string;
  evidence?: string[];
  witnessClaims?: string[];
  context?: string;
  threadHistory?: string[];
}

export interface InsightResponse {
  insight: string;
  confidence: number;
  reasoning: string;
  nextRequiredCard: "Mental Model" | "Demonstration" | "Experiment" | "Witness";
  mentalModel?: string;
  experimentCandidate?: string;
  witnessPrompt?: string;
  clarificationQuestion?: string;
}

const UNDERSTAND_SYSTEM = `You are the Axis Insight Engine.

Your job is not to solve the problem.
Your job is to identify the highest-leverage observation.

Given a player's intent, find the single observation that, if named, changes what the player does next.

Output fields:
- insight: 1 sentence. The single highest-leverage observation. Specific mechanism or hidden assumption. Not a diagnosis. Not a category.
- confidence: 0.0–1.0
- reasoning: 2-3 sentences. Why this observation matters. What constraint it names. Not coaching — analysis of the mechanism.
- nextRequiredCard: exactly one of "Mental Model" | "Demonstration" | "Experiment" | "Witness"
  - Mental Model → insight is conceptual; player needs the frame before acting
  - Demonstration → insight is perceptual; player needs to see it on video or live
  - Experiment → insight is action-ready; player can apply it in the next rep
  - Witness → player needs to observe specific behavior in themselves or the environment
- mentalModel: 2-3 sentences. The frame that makes the constraint visible. Populate only when nextRequiredCard is "Mental Model".
- experimentCandidate: 1 imperative sentence. Specific and observable. Populate only when nextRequiredCard is "Experiment".
- witnessPrompt: 1 sentence. What exactly to observe. Populate only when nextRequiredCard is "Witness".
- clarificationQuestion: only when confidence < 0.72. ONE question. Name 2-3 specific sub-problems.

Rules:
- confidence >= 0.72: insight must be specific. Omit clarificationQuestion. Populate the field for the selected card.
- confidence < 0.72: include clarificationQuestion. insight may be directional.
- Do not populate mentalModel, experimentCandidate, and witnessPrompt simultaneously. Populate only the one matching nextRequiredCard.
- Under 3 words of input, or no clear athletic domain → confidence must be below 0.72.

Language: direct, coaching voice. No consultant framing. No generic advice. No "unclear" constructions.

JSON only. No markdown.

Few-shot examples:

Intent: "triple threat"
{"insight":"Every second standing still in triple threat is time the defense uses to take an option away.","confidence":0.88,"reasoning":"The triple threat only works while the defender can't read your next action. The moment the body goes still, the defender relaxes and eliminates a lane. The threat isn't the ball position — it's the time pressure on the defense.","nextRequiredCard":"Experiment","experimentCandidate":"Attack before the defender settles."}

Intent: "spacing"
{"insight":"Players are finding space where the defense isn't — not where the next pass goes.","confidence":0.84,"reasoning":"Good spacing isn't about spreading out — it's about being in the right position at the right moment in the ball sequence. Space that isn't connected to what the ball is about to do is just distance.","nextRequiredCard":"Mental Model","mentalModel":"Think of spacing as timing, not geography. The space that matters is the one that will be open in two seconds, not the one that's empty now."}

Intent: "my jump shot"
{"insight":"Jump shot inconsistency most often lives in when in the jump the shot fires — the timing variable is shifting, not the mechanics.","confidence":0.65,"reasoning":"If release point within the jump shifts rep to rep, the same hand mechanics produce different arcs every time. Adjusting grip or wrist when the real variable is timing produces no consistent improvement.","nextRequiredCard":"Demonstration","clarificationQuestion":"Is it consistency off the catch, off the dribble, or under fatigue?"}`;

const CARD_TYPES = ["Mental Model", "Demonstration", "Experiment", "Witness"] as const;
type CardType = typeof CARD_TYPES[number];

function isCardType(val: unknown): val is CardType {
  return typeof val === "string" && CARD_TYPES.includes(val as CardType);
}

function safeParse(raw: string): InsightResponse {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;

    const confidence = typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.5;

    const nextRequiredCard: CardType = isCardType(parsed.nextRequiredCard)
      ? parsed.nextRequiredCard
      : "Mental Model";

    return {
      insight: typeof parsed.insight === "string" && parsed.insight.trim()
        ? parsed.insight.trim()
        : "The real constraint underneath this intent.",
      confidence,
      reasoning: typeof parsed.reasoning === "string" && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : "What would change if this constraint was already resolved?",
      nextRequiredCard,
      mentalModel: typeof parsed.mentalModel === "string" && parsed.mentalModel.trim()
        ? parsed.mentalModel.trim()
        : undefined,
      experimentCandidate: typeof parsed.experimentCandidate === "string" && parsed.experimentCandidate.trim()
        ? parsed.experimentCandidate.trim()
        : undefined,
      witnessPrompt: typeof parsed.witnessPrompt === "string" && parsed.witnessPrompt.trim()
        ? parsed.witnessPrompt.trim()
        : undefined,
      clarificationQuestion: typeof parsed.clarificationQuestion === "string" && parsed.clarificationQuestion.trim()
        ? parsed.clarificationQuestion.trim()
        : undefined,
    };
  } catch {
    return {
      insight: "Could not parse understanding.",
      confidence: 0,
      reasoning: "Try again.",
      nextRequiredCard: "Mental Model",
    };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ confidence: 0 }, { status: 503 });
  }

  let body: UnderstandRequest;
  try {
    body = await req.json() as UnderstandRequest;
  } catch {
    return Response.json({ confidence: 0 }, { status: 400 });
  }

  const { intent, evidence, witnessClaims, context, threadHistory } = body;
  if (!intent?.trim()) {
    return Response.json({ confidence: 0 }, { status: 400 });
  }

  const userContent = [
    `Intent: "${intent.trim()}"`,
    evidence?.length ? `Evidence available: ${evidence.join(", ")}` : null,
    witnessClaims?.length ? `Witness claims:\n${witnessClaims.join("\n")}` : null,
    context ? `Context: ${context}` : null,
    threadHistory?.length
      ? `Prior exchange:\n${threadHistory.slice(-4).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: UNDERSTAND_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/understand]", response.status, errText);
      return Response.json({ confidence: 0 }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/understand]", e.message);
    return Response.json({ confidence: 0 }, { status: 500 });
  }
}
