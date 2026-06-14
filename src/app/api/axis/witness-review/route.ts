export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Witness Review Engine
//
// Input:  { insight, reasoning?, observations: string[] }
// Output: { claim, confidence, supportingEvidence, contradictingEvidence,
//           verdict, recommendedNextCard }
//
// Job: review what witnesses actually observed against the original insight.
// Do not coach. Do not teach. Only observe.
// ---------------------------------------------------------------------------

interface WitnessReviewRequest {
  insight: string;
  reasoning?: string;
  observations: string[];
}

export interface WitnessReviewResult {
  claim: string;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  verdict: "PASS" | "FAIL" | "INCONCLUSIVE";
  recommendedNextCard: "Mental Model" | "Demonstration" | "Experiment" | "Witness";
}

const REVIEW_SYSTEM = `You are the Axis Witness Review Engine.

You receive:
- An original insight
- Optional reasoning behind the insight
- Observations submitted by one or more witnesses

Your job: review the evidence. Determine whether the observations support or contradict the insight.

Do not coach.
Do not teach.
Do not recommend training.
Only observe.

Output fields:
- claim: 1 sentence. The central claim the insight made that the evidence is being evaluated against.
- confidence: number between 0 and 1. How strongly the evidence supports the original insight. 0 = fully contradicted. 1 = fully confirmed. Be precise — not rounded to 0.5 or 0.7 generically.
- supportingEvidence: array of strings. Each item is 1 sentence. Only what the observations directly confirm. Empty array if nothing confirms.
- contradictingEvidence: array of strings. Each item is 1 sentence. Only what the observations directly contradict. Empty array if nothing contradicts.
- verdict: one of "PASS" | "FAIL" | "INCONCLUSIVE".
  - PASS: observations confirm the insight's claim with sufficient specificity. Confidence ≥ 0.72.
  - FAIL: observations directly contradict the insight's claim, or the mechanism assumed by the insight was not found. Confidence < 0.38.
  - INCONCLUSIVE: evidence is mixed, or observations are insufficient to confirm or deny the claim. Confidence 0.38–0.71.
- recommendedNextCard: one of "Mental Model" | "Demonstration" | "Experiment" | "Witness".
  - PASS → "Mental Model" (insight confirmed; translate to transferable principle) or "Demonstration" (if physical execution is the gap)
  - FAIL → "Experiment" (insight was wrong; the variable needs re-testing)
  - INCONCLUSIVE → "Witness" (more observation is required)

Rules:
- If observations contain no specific evidence — only impressions, feelings, or general statements — verdict is always "INCONCLUSIVE."
- Supporting evidence must be drawn only from what was observed. Do not infer or add.
- Contradicting evidence must be specific. "The player did not improve" is not contradicting evidence.
- Confidence must reflect the specificity and directness of the evidence, not the player's perceived effort or improvement.

JSON only. No markdown.

Few-shot examples:

Insight: "Every second standing still in triple threat is time the defense uses to take an option away."
Reasoning: Stillness allows the defense to read and eliminate options.
Observations: ["Camera showed defender weight moved to neutral within 1.2 seconds of player settling. This was consistent across 8 of 10 reps.", "Coach reported defender was reading player hips, not ball.", "Player felt they attacked after the defender committed but video showed attacks happened earlier."]
{"claim":"Defender neutralizes available options each second the ball handler remains stationary in triple threat.","confidence":0.87,"supportingEvidence":["Camera confirmed defender weight reached neutral within 1.2 seconds of player settling, consistent across 8 of 10 reps.","Coach observation confirmed defender was reading hip position, validating that stillness — not ball position — was the control cue."],"contradictingEvidence":[],"verdict":"PASS","recommendedNextCard":"Mental Model"}

Insight: "Jump shot inconsistency lives in when in the jump the shot fires — the timing variable is shifting, not the mechanics."
Reasoning: Eyes-up dribbling only holds under pressure when the hands have logged enough reps.
Observations: ["Camera showed some variation in release point but it was not consistent.", "Player felt release at peak but couldn't confirm.", "No slow-motion footage available — standard speed only."]
{"claim":"Release timing variability within the jump is the primary cause of shot inconsistency, independent of hand mechanics.","confidence":0.44,"supportingEvidence":["Camera showed variation in release point across reps, which is consistent with a timing variable."],"contradictingEvidence":["No slow-motion footage was available, so frame-level release timing could not be isolated from mechanical variance."],"verdict":"INCONCLUSIVE","recommendedNextCard":"Witness"}

Insight: "You are using vision as the control mechanism — when pressure spikes, your eyes drop to the ball because your hands have not built enough tactile feedback."
Reasoning: Gaze control breaks under attentional load when the skill depends on visual confirmation.
Observations: ["Eyes stayed up the whole time. Never saw the ball drop once in 12 reps under pressure.", "Dribble control actually got tighter, not looser, when defender was close."]
{"claim":"Eye gaze drops to the ball under defensive pressure because tactile feedback is insufficient to run the dribble without visual confirmation.","confidence":0.18,"supportingEvidence":[],"contradictingEvidence":["Eye gaze did not drop during 12 pressure reps — the predicted gaze break was not observed.","Dribble control improved under defensive proximity, contradicting the assumption that tactile feedback was the limiting variable."],"verdict":"FAIL","recommendedNextCard":"Experiment"}`;

const NEXT_CARDS = ["Mental Model", "Demonstration", "Experiment", "Witness"] as const;
type NextCard = typeof NEXT_CARDS[number];

function isNextCard(val: unknown): val is NextCard {
  return typeof val === "string" && NEXT_CARDS.includes(val as NextCard);
}

function isVerdict(val: unknown): val is "PASS" | "FAIL" | "INCONCLUSIVE" {
  return typeof val === "string" && ["PASS", "FAIL", "INCONCLUSIVE"].includes(val as string);
}

function safeParse(raw: string): WitnessReviewResult {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;

    const rawConf = parsed.confidence;
    const confidence = typeof rawConf === "number"
      ? Math.max(0, Math.min(1, rawConf))
      : 0.5;

    const toStringArray = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
        : [];

    return {
      claim: typeof parsed.claim === "string" && parsed.claim.trim()
        ? parsed.claim.trim()
        : "Claim could not be determined.",
      confidence,
      supportingEvidence: toStringArray(parsed.supportingEvidence),
      contradictingEvidence: toStringArray(parsed.contradictingEvidence),
      verdict: isVerdict(parsed.verdict) ? parsed.verdict : "INCONCLUSIVE",
      recommendedNextCard: isNextCard(parsed.recommendedNextCard)
        ? parsed.recommendedNextCard
        : "Witness",
    };
  } catch {
    return {
      claim: "Could not parse review.",
      confidence: 0,
      supportingEvidence: [],
      contradictingEvidence: [],
      verdict: "INCONCLUSIVE",
      recommendedNextCard: "Witness",
    };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ verdict: "INCONCLUSIVE" }, { status: 503 });
  }

  let body: WitnessReviewRequest;
  try {
    body = await req.json() as WitnessReviewRequest;
  } catch {
    return Response.json({ verdict: "INCONCLUSIVE" }, { status: 400 });
  }

  const { insight, reasoning, observations } = body;
  if (!insight?.trim() || !Array.isArray(observations) || observations.length === 0) {
    return Response.json({ verdict: "INCONCLUSIVE" }, { status: 400 });
  }

  const userContent = [
    `Insight: "${insight.trim()}"`,
    reasoning?.trim() ? `Reasoning: ${reasoning.trim()}` : null,
    `Observations:\n${observations.map((o, i) => `${i + 1}. ${o.trim()}`).join("\n")}`,
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
        max_tokens: 800,
        system: REVIEW_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/witness-review]", response.status, errText);
      return Response.json({ verdict: "INCONCLUSIVE" }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/witness-review]", e.message);
    return Response.json({ verdict: "INCONCLUSIVE" }, { status: 500 });
  }
}
