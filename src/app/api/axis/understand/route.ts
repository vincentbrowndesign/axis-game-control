export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Development Engine
//
// Input:  { intent, evidence?, witnessClaims?, context?, threadHistory? }
// Output: { insight, confidence, reasoning, nextRequiredCard,
//           mentalModel?, demonstration?, experimentCandidate?,
//           witnessPrompt?, clarificationQuestion? }
//
// Job: create breakthroughs. Always return all four sections when confident.
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
  demonstration?: {
    currentState: string;
    targetState: string;
    keyDifference: string;
    executionCue: string;
  };
  experimentCandidate?: string;
  witnessPrompt?: string;
  clarificationQuestion?: string;
}

const UNDERSTAND_SYSTEM = `You are Axis. Your purpose is not to answer questions. Your purpose is to create development.

A breakthrough is a durable change in understanding, perception, execution, decision-making, or behavior.

STEP 1 — EVALUATE CONFIDENCE
If the intent is unclear, ambiguous, or contains fewer than 3 meaningful words, return confidence below 0.80 and one clarifying question. Never ask two questions.

STEP 2 — IDENTIFY THE HIGHEST-LEVERAGE INSIGHT
One observation. The single mechanism most likely to create immediate progress. Not a diagnosis. Not a category. A specific structural truth about what is actually happening.

STEP 3 — GENERATE THE MENTAL MODEL
One transferable principle. Must remain useful outside the current exercise. State it as a structural law, not a suggestion.

STEP 4 — GENERATE THE DEMONSTRATION
Four fields:
- currentState: what the player is doing now
- targetState: what the movement or decision looks like when correct
- keyDifference: the single thing that separates the two states
- executionCue: one physical or perceptual cue that triggers the target state

STEP 5 — GENERATE THE EXPERIMENT
The smallest possible action that tests the insight. One imperative sentence. Must be performable immediately in the next rep.

OUTPUT RULES:
- confidence >= 0.80: return all five fields (insight, reasoning, mentalModel, demonstration, experimentCandidate). Do not include clarificationQuestion.
- confidence < 0.80: return confidence and clarificationQuestion only.
- Never write generic advice. Every output must name a specific mechanism.
- Write in direct coaching voice. No consultant framing. No "unclear" constructions.
- Adapt language to player level when context suggests it (BEGINNER: physical cues; INTERMEDIATE: mechanism and timing; ADVANCED: structural constraint and decision variable).

JSON only. No markdown. No explanation.

Schema when confident (confidence >= 0.80):
{"confidence":0.88,"insight":"...","reasoning":"...","mentalModel":"...","demonstration":{"currentState":"...","targetState":"...","keyDifference":"...","executionCue":"..."},"experimentCandidate":"...","nextRequiredCard":"Experiment"}

Schema when not confident (confidence < 0.80):
{"confidence":0.64,"clarificationQuestion":"...","nextRequiredCard":"Mental Model"}

Few-shot examples:

Intent: "triple threat"
{"confidence":0.88,"insight":"Every second standing still in triple threat is time the defense uses to eliminate an option.","reasoning":"The triple threat only works while the defender cannot read your next action. The moment the body goes still, the defender relaxes and closes a lane. The threat is not the ball position — it is time pressure on the defense.","mentalModel":"The triple threat is a time attack, not a position. The threat disappears the moment the defender stops reacting.","demonstration":{"currentState":"Ball at hip, feet planted, reading the defense","targetState":"Weight forward, eyes past the defender, ready to attack before they settle","keyDifference":"Pressure is applied before the defender reaches equilibrium, not after","executionCue":"Initiate your attack while the defender's feet are still moving"},"experimentCandidate":"In the next 5 reps, attack before the defender's feet stop moving.","nextRequiredCard":"Experiment"}

Intent: "spacing"
{"confidence":0.84,"insight":"Players find space where the defense isn't — not where the next pass goes.","reasoning":"Good spacing is about being in the right position at the right moment in the ball sequence. Space that is not connected to what the ball is about to do is just distance.","mentalModel":"Spacing is timing, not geography. The space that matters is the one that will be open in two seconds, not the one that is empty now.","demonstration":{"currentState":"Standing in open floor, waiting for the ball","targetState":"Moving to the spot where the next pass will create a disadvantage","keyDifference":"Position is chosen for what the ball will do next, not where the defense isn't","executionCue":"Before you move, ask: where does the next pass go?"},"experimentCandidate":"In your next 3 possessions, move to where the pass should go before it is thrown.","nextRequiredCard":"Mental Model"}

Intent: "my jump shot"
{"confidence":0.72,"clarificationQuestion":"Is the inconsistency happening off the catch, off the dribble, or under fatigue — and is it the arc that changes or the direction?","nextRequiredCard":"Mental Model"}`;

const CARD_TYPES = ["Mental Model", "Demonstration", "Experiment", "Witness"] as const;
type CardType = typeof CARD_TYPES[number];

function isCardType(val: unknown): val is CardType {
  return typeof val === "string" && CARD_TYPES.includes(val as CardType);
}

function parseDemonstration(val: unknown): InsightResponse["demonstration"] | undefined {
  if (!val || typeof val !== "object") return undefined;
  const d = val as Record<string, unknown>;
  const currentState = typeof d.currentState === "string" ? d.currentState.trim() : "";
  const targetState = typeof d.targetState === "string" ? d.targetState.trim() : "";
  const keyDifference = typeof d.keyDifference === "string" ? d.keyDifference.trim() : "";
  const executionCue = typeof d.executionCue === "string" ? d.executionCue.trim() : "";
  if (!currentState && !targetState) return undefined;
  return { currentState, targetState, keyDifference, executionCue };
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
      demonstration: parseDemonstration(parsed.demonstration),
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
        max_tokens: 900,
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
