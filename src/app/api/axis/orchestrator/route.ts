export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Thread Orchestrator
//
// Input:  { insight, reasoning?, history }
// Output: { nextCard, reason, requiredInputs, expectedOutcome }
//
// Job: read the current thread state and decide the next card.
// Not an engine that produces content. A routing decision.
// ---------------------------------------------------------------------------

type CardName =
  | "Insight"
  | "Mental Model"
  | "Demonstration"
  | "Experiment"
  | "Witness"
  | "Adjustment"
  | null;

interface CardRecord {
  card: string;
  outcome?: string;
}

interface OrchestratorRequest {
  insight: string;
  reasoning?: string;
  history: CardRecord[];
}

export interface OrchestratorDecision {
  nextCard: CardName;
  reason: string;
  requiredInputs: string[];
  expectedOutcome: string;
}

const CARDS = ["Insight", "Mental Model", "Demonstration", "Experiment", "Witness", "Adjustment"] as const;

const ORCHESTRATOR_SYSTEM = `You are the Axis Thread Orchestrator.

You receive an insight, optional reasoning, and a history of which cards have already run and what each produced.

Your job: decide the next card. One decision. Be specific.

Available cards:
- Insight: generates the highest-leverage observation from an intent. Runs first. May re-run if the current insight was invalidated.
- Mental Model: translates the insight into a transferable principle. Runs when the insight is confirmed and needs to be understood.
- Demonstration: converts the insight into a renderer-agnostic visual specification. Runs when execution gap is the primary need.
- Experiment: designs the smallest experiment to validate the insight. Runs when the mechanism is unconfirmed and testable.
- Witness: determines which observers are needed and what they must capture. Runs when observation is required before or after an experiment.
- Adjustment: reviews witness evidence and decides the next action. Runs after a witness review is complete.

Output fields:
- nextCard: one of the 6 card names, or null if the thread is complete.
- reason: 1-2 sentences. Why this card is the correct next step given the thread state. Reference what the last card produced and what is still missing.
- requiredInputs: array of strings. What inputs this card needs that are not already in the thread. Each item is 1-2 words, specific. Empty if all inputs are already available.
- expectedOutcome: 1 sentence. What this card will produce that the thread does not currently have.

Routing rules:
- If no cards have run: always "Insight."
- After Insight, if nextRequiredCard was Mental Model and no Mental Model exists: "Mental Model."
- After Insight, if nextRequiredCard was Demonstration and no Demonstration exists: "Demonstration."
- After Insight, if nextRequiredCard was Experiment and no Experiment exists: "Experiment."
- After Insight, if nextRequiredCard was Witness and no Witness plan exists: "Witness."
- After Mental Model: "Demonstration" if execution gap exists, otherwise null (complete).
- After Demonstration: "Experiment" if mechanism is still unconfirmed, otherwise null (complete).
- After Experiment: "Witness" to observe results.
- After Witness plan: wait for observations — next card depends on what is observed.
- After Witness Review PASS: "Mental Model" if not yet run, otherwise "Demonstration" if not yet run, otherwise null (complete).
- After Witness Review FAIL: "Experiment" to retest with corrected hypothesis.
- After Witness Review INCONCLUSIVE: "Witness" to gather more specific observation.
- After Adjustment "Complete Thread": null.
- After Adjustment "Escalate Investigation": "Witness" with deeper configuration.
- After Adjustment "Repeat Experiment": "Experiment."
- After Adjustment "Increase Difficulty": "Experiment."
- After Adjustment "Decrease Difficulty": "Experiment."
- After Adjustment "New Demonstration": "Demonstration."
- After Adjustment "New Mental Model": "Mental Model."
- After Adjustment "New Witness": "Witness."
- Never suggest a card that already ran in this thread unless Adjustment explicitly calls for it.

JSON only. No markdown.

Few-shot examples:

Insight: "Every second standing still in triple threat is time the defense uses to take an option away."
History: [{"card":"Insight","outcome":"nextRequiredCard: Mental Model, confidence: 0.82"},{"card":"Mental Model","outcome":"rule: Motion is threat; stillness is permission"}]
{"nextCard":"Demonstration","reason":"The Mental Model has been generated. The next gap is execution — the player understands the principle but needs a visual specification of what the correct and incorrect movement looks like.","requiredInputs":[],"expectedOutcome":"A renderer-agnostic visual specification of current vs. target triple threat behavior with viewpoints and animation notes."}

Insight: "Jump shot inconsistency most often lives in when in the jump the shot fires."
History: [{"card":"Insight","outcome":"nextRequiredCard: Experiment, confidence: 0.78"},{"card":"Experiment","outcome":"hypothesis: fixing release at peak height will stabilize arc"},{"card":"Witness","outcome":"plan: Camera, Computer Vision, User"},{"card":"Witness Review","outcome":"INCONCLUSIVE, confidence: 0.44 — no slow-motion footage"},{"card":"Adjustment","outcome":"decision: New Witness"}]
{"nextCard":"Witness","reason":"Adjustment called for a new witness after the review was inconclusive due to missing slow-motion footage. The required evidence — frame-level release timing — was not captured in the first observation set.","requiredInputs":["Slow-motion footage"],"expectedOutcome":"A revised witness plan specifying the minimum camera configuration required to isolate release timing from mechanical variance."}

Insight: "Players find space where the defense isn't — not where the next pass goes."
History: [{"card":"Insight","outcome":"nextRequiredCard: Witness, confidence: 0.81"},{"card":"Witness","outcome":"plan: Camera, Coach, User"},{"card":"Witness Review","outcome":"PASS, confidence: 0.91"},{"card":"Adjustment","outcome":"decision: Complete Thread"}]
{"nextCard":null,"reason":"Adjustment determined the thread is complete. Confidence is 0.91 with three independent witnesses confirming the mechanism. The insight is confirmed, understood, and actionable.","requiredInputs":[],"expectedOutcome":"Thread is closed."}

Insight: "You are using vision as the control mechanism — eyes drop to ball under pressure."
History: [{"card":"Insight","outcome":"nextRequiredCard: Witness, confidence: 0.76"},{"card":"Witness","outcome":"plan: Camera, Coach, User"},{"card":"Witness Review","outcome":"FAIL, confidence: 0.11 — gaze never dropped across 10 reps"},{"card":"Adjustment","outcome":"decision: Escalate Investigation"}]
{"nextCard":"Witness","reason":"Adjustment called Escalate Investigation after the insight's assumed mechanism was directly contradicted by all three witnesses. The original variable — gaze drop under pressure — was not present, so the investigation needs to identify what variable actually degrades for this player.","requiredInputs":["New observation focus","Pressure conditions"],"expectedOutcome":"A witness plan oriented around identifying what actually changes under defensive pressure for this player — not confirming the original hypothesis."}`;

function isCardName(val: unknown): val is CardName {
  return val === null || (typeof val === "string" && ([...CARDS] as string[]).includes(val));
}

function safeParse(raw: string): OrchestratorDecision {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;

    const rawNext = parsed.nextCard;
    const nextCard: CardName = isCardName(rawNext) ? rawNext : "Witness";

    const rawInputs = parsed.requiredInputs;
    const requiredInputs: string[] = Array.isArray(rawInputs)
      ? rawInputs.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
      : [];

    return {
      nextCard,
      reason: typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "Next card could not be determined.",
      requiredInputs,
      expectedOutcome: typeof parsed.expectedOutcome === "string" && parsed.expectedOutcome.trim()
        ? parsed.expectedOutcome.trim()
        : "Next card will produce additional signal.",
    };
  } catch {
    return {
      nextCard: "Witness",
      reason: "Could not parse orchestration decision.",
      requiredInputs: [],
      expectedOutcome: "More observation required.",
    };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ nextCard: null }, { status: 503 });
  }

  let body: OrchestratorRequest;
  try {
    body = await req.json() as OrchestratorRequest;
  } catch {
    return Response.json({ nextCard: null }, { status: 400 });
  }

  const { insight, reasoning, history } = body;
  if (!insight?.trim() || !Array.isArray(history)) {
    return Response.json({ nextCard: null }, { status: 400 });
  }

  const historyText = history
    .map((h, i) => `${i + 1}. ${h.card}${h.outcome ? ` — ${h.outcome}` : ""}`)
    .join("\n");

  const userContent = [
    `Insight: "${insight.trim()}"`,
    reasoning?.trim() ? `Reasoning: ${reasoning.trim()}` : null,
    `History:\n${historyText}`,
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
        max_tokens: 400,
        system: ORCHESTRATOR_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/orchestrator]", response.status, errText);
      return Response.json({ nextCard: null }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/orchestrator]", e.message);
    return Response.json({ nextCard: null }, { status: 500 });
  }
}
