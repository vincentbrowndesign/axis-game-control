export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Adjustment Engine
//
// Input:  { insight, reasoning?, review }
// Output: { decision, reason, expectedBenefit, nextCard }
//
// Job: based on witness review results, determine what should happen next.
// One decision. One direction.
// ---------------------------------------------------------------------------

type Verdict = "PASS" | "FAIL" | "INCONCLUSIVE";

interface WitnessReview {
  claim: string;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  verdict: Verdict;
  recommendedNextCard: string;
}

interface AdjustmentRequest {
  insight: string;
  reasoning?: string;
  review: WitnessReview;
}

const DECISIONS = [
  "Repeat Experiment",
  "Increase Difficulty",
  "Decrease Difficulty",
  "New Demonstration",
  "New Mental Model",
  "New Witness",
  "Escalate Investigation",
  "Complete Thread",
] as const;

type Decision = typeof DECISIONS[number];

type NextCard = "Mental Model" | "Demonstration" | "Experiment" | "Witness" | null;

export interface AdjustmentResult {
  decision: Decision;
  reason: string;
  expectedBenefit: string;
  nextCard: NextCard;
}

const ADJUSTMENT_SYSTEM = `You are the Axis Adjustment Engine.

You receive an original insight and the results of a witness review.

Your job: determine what should happen next. One decision. Be specific. Be direct.

Available decisions:
- Repeat Experiment: the experiment design was valid but the evidence was insufficient — not enough reps, not the right conditions, or the constraint was not held.
- Increase Difficulty: the insight was confirmed at the current level but the mechanism has not been tested under pressure, speed, or complexity.
- Decrease Difficulty: the constraint was too hard to isolate the variable — the result reflects execution difficulty, not the insight variable itself.
- New Demonstration: the insight is understood but the physical execution gap needs a better visual specification.
- New Mental Model: the insight requires a different framework — the current mental model is not transferable enough or was not produced yet.
- New Witness: the review was inconclusive because the wrong witnesses were queried or the observations were too general.
- Escalate Investigation: the insight itself may be wrong or incomplete — the mechanism assumed needs deeper examination before any experiment is valid.
- Complete Thread: sufficient understanding has been achieved. The insight is confirmed, understood, and actionable. Stop here.

Output fields:
- decision: one of the 8 decisions exactly as written above.
- reason: 1-2 sentences. Why this specific decision was made based on the evidence. Reference the verdict and confidence. Be specific.
- expectedBenefit: 1 sentence. What this decision will produce that the current state does not have.
- nextCard: one of "Mental Model" | "Demonstration" | "Experiment" | "Witness" | null.
  - "Repeat Experiment" → "Experiment"
  - "Increase Difficulty" → "Experiment"
  - "Decrease Difficulty" → "Experiment"
  - "New Demonstration" → "Demonstration"
  - "New Mental Model" → "Mental Model"
  - "New Witness" → "Witness"
  - "Escalate Investigation" → "Witness"
  - "Complete Thread" → null

Rules:
- If verdict is PASS and confidence ≥ 0.80: prefer "Complete Thread" unless a mental model or demonstration has not been produced.
- If verdict is PASS and confidence 0.72–0.79: prefer "Increase Difficulty" to test whether the insight holds under higher pressure.
- If verdict is FAIL and contradicting evidence is specific and direct: prefer "Escalate Investigation" — the insight variable was wrong, not the experiment.
- If verdict is FAIL and contradicting evidence is vague or missing: prefer "Repeat Experiment" — the result may be execution noise, not signal.
- If verdict is INCONCLUSIVE and supporting and contradicting evidence both exist: prefer "New Witness" — the existing evidence is split and more specific observation is required.
- If verdict is INCONCLUSIVE and observations were too general: prefer "Repeat Experiment" — the experiment constraint was not tight enough.
- Never choose "Complete Thread" if verdict is FAIL or INCONCLUSIVE.
- Never choose "Repeat Experiment" if the supporting evidence is empty and contradicting evidence is strong — that is Escalate, not Repeat.

JSON only. No markdown.

Few-shot examples:

Insight: "Every second standing still in triple threat is time the defense uses to take an option away."
Review: {"claim":"Defender neutralizes available options each second the ball handler remains stationary in triple threat.","confidence":0.91,"supportingEvidence":["Defender weight moved to neutral within 1 second in 8 of 10 reps.","Coach confirmed defender was reading hips, validating stillness as the control cue.","On 2 reps with micro-movement, defender never settled."],"contradictingEvidence":[],"verdict":"PASS","recommendedNextCard":"Mental Model"}
{"decision":"Complete Thread","reason":"Confidence is 0.91 with three independent witnesses confirming the mechanism across 10 reps. The claim is specific, the evidence is direct, and the variable is isolated.","expectedBenefit":"Thread is closed with confirmed understanding — the insight, its mechanism, and its boundary conditions are established.","nextCard":null}

Insight: "Jump shot inconsistency most often lives in when in the jump the shot fires — the timing variable is shifting, not the mechanics."
Review: {"claim":"Release timing variability within the jump is the primary cause of shot inconsistency, independent of hand mechanics.","confidence":0.44,"supportingEvidence":["Camera showed variation in release point across reps."],"contradictingEvidence":["No slow-motion footage — frame-level release timing could not be isolated from mechanical variance."],"verdict":"INCONCLUSIVE","recommendedNextCard":"Witness"}
{"decision":"New Witness","reason":"Confidence is 0.44 and the inconclusive result is caused by missing evidence — no slow-motion footage means the timing variable cannot be separated from mechanical variance. The experiment design was correct but the required evidence was not captured.","expectedBenefit":"Slow-motion camera witness will produce frame-level release timing data, which is the minimum required to confirm or deny the timing hypothesis.","nextCard":"Witness"}

Insight: "You are using vision as the control mechanism — when pressure spikes, your eyes drop to the ball because your hands have not built enough tactile feedback."
Review: {"claim":"Eye gaze drops to the ball under defensive pressure because tactile feedback is insufficient.","confidence":0.11,"supportingEvidence":[],"contradictingEvidence":["Eye gaze did not drop once across 10 pressure reps.","Dribble rhythm remained consistent under close defensive pressure.","Coach observed hands appeared automatic, not reactive."],"verdict":"FAIL","recommendedNextCard":"Experiment"}
{"decision":"Escalate Investigation","reason":"Confidence is 0.11 and three independent witnesses directly contradict the mechanism — the gaze drop was not observed and control did not degrade under pressure. The insight's assumed mechanism is not present for this player at this skill level.","expectedBenefit":"Deeper observation will identify what variable actually degrades under pressure for this player, producing a better-calibrated insight before any experiment is designed.","nextCard":"Witness"}`;

function isDecision(val: unknown): val is Decision {
  return typeof val === "string" && DECISIONS.includes(val as Decision);
}

function isNextCard(val: unknown): val is NextCard {
  return val === null || ["Mental Model", "Demonstration", "Experiment", "Witness"].includes(val as string);
}

function safeParse(raw: string): AdjustmentResult {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;

    const rawNext = parsed.nextCard;
    const nextCard: NextCard = isNextCard(rawNext) ? rawNext : "Witness";

    return {
      decision: isDecision(parsed.decision) ? parsed.decision : "New Witness",
      reason: typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "Adjustment could not be determined.",
      expectedBenefit: typeof parsed.expectedBenefit === "string" && parsed.expectedBenefit.trim()
        ? parsed.expectedBenefit.trim()
        : "Next action will produce more signal.",
      nextCard,
    };
  } catch {
    return {
      decision: "New Witness",
      reason: "Could not parse adjustment.",
      expectedBenefit: "More observation required.",
      nextCard: "Witness",
    };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ decision: "New Witness" }, { status: 503 });
  }

  let body: AdjustmentRequest;
  try {
    body = await req.json() as AdjustmentRequest;
  } catch {
    return Response.json({ decision: "New Witness" }, { status: 400 });
  }

  const { insight, reasoning, review } = body;
  if (!insight?.trim() || !review) {
    return Response.json({ decision: "New Witness" }, { status: 400 });
  }

  const userContent = [
    `Insight: "${insight.trim()}"`,
    reasoning?.trim() ? `Reasoning: ${reasoning.trim()}` : null,
    `Review: ${JSON.stringify(review)}`,
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
        system: ADJUSTMENT_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/adjustment]", response.status, errText);
      return Response.json({ decision: "New Witness" }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/adjustment]", e.message);
    return Response.json({ decision: "New Witness" }, { status: 500 });
  }
}
