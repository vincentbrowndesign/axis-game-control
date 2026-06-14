export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Understanding API
//
// Input:  { intent, context?, threadHistory? }
// Output: { confidence, leveragePoint, mentalModel, commonMistake?,
//           experimentCandidate, clarificationQuestion? }
//
// Claude's job: find the leverage point and mental model.
// Not essays. Not coaching. Not chatty explanations.
// ---------------------------------------------------------------------------

interface UnderstandRequest {
  intent: string;
  context?: string;
  threadHistory?: string[];
}

interface UnderstandResponse {
  confidence: number;
  leveragePoint: string;
  mentalModel: string;
  commonMistake?: string;
  experimentCandidate: string;
  clarificationQuestion?: string;
}

const UNDERSTAND_SYSTEM = `You are a sports development intelligence. Your job: find the leverage point inside a player's stated intent.

A leverage point is NOT the topic. It is the specific constraint that, if changed, unlocks the most improvement.

Example:
Intent: "Triple Threat"
Wrong leverage point: "Basketball"
Right leverage point: "Waiting for information the defender isn't going to give you."

Rules:
- leveragePoint: 1 sentence. The real problem underneath the intent.
- mentalModel: 2-3 sentences. The conceptual reframe that unlocks the constraint.
- commonMistake: 1 sentence. What athletes usually do wrong here.
- experimentCandidate: 1 imperative sentence + "90 seconds." e.g. "Create a reaction before attacking. 90 seconds."
- clarificationQuestion: only if confidence < 0.70. ONE question, specific to the domain. Name 2-3 sub-problems.
- confidence: 0.0–1.0 — how certain you are that you found the real leverage point.

If confidence >= 0.70: omit clarificationQuestion entirely.
If confidence < 0.70: include clarificationQuestion, omit nothing else.

No essays. No lists. No coaching paragraphs. JSON only.

Few-shot examples:

Intent: "triple threat"
{"confidence":0.85,"leveragePoint":"Waiting for information the defender isn't going to give you.","mentalModel":"The defender is also waiting. Nothing changes until someone creates information. The triple threat stops being a threat the moment it becomes a pause.","commonMistake":"Reading the defender instead of making the defender read you.","experimentCandidate":"Create a reaction before attacking. 90 seconds."}

Intent: "handles"
{"confidence":0.40,"leveragePoint":"Using the dribble to manage rather than to create.","mentalModel":"Every dribble should put the defense in a worse position. Dribbling to think is just possession risk.","commonMistake":"Dribbling in place instead of attacking angles.","experimentCandidate":"Change the angle with every dribble. 90 seconds.","clarificationQuestion":"Is it pressure, eyes, or changing speeds that's getting you?"}

Intent: "I freeze when my man doesn't move"
{"confidence":0.92,"leveragePoint":"Mistaking stillness for safety.","mentalModel":"A defender who isn't moving is telling you they've made a choice. That choice creates a gap — but only for someone who's ready to attack it.","commonMistake":"Waiting for the defender to commit before deciding.","experimentCandidate":"Attack the first gap you see. 90 seconds."}`;

function safeParse(raw: string): UnderstandResponse {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;
    return {
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      leveragePoint: typeof parsed.leveragePoint === "string" && parsed.leveragePoint.trim()
        ? parsed.leveragePoint.trim()
        : "The real constraint underneath this intent.",
      mentalModel: typeof parsed.mentalModel === "string" && parsed.mentalModel.trim()
        ? parsed.mentalModel.trim()
        : "What would change if you already had this?",
      commonMistake: typeof parsed.commonMistake === "string" && parsed.commonMistake.trim()
        ? parsed.commonMistake.trim()
        : undefined,
      experimentCandidate: typeof parsed.experimentCandidate === "string" && parsed.experimentCandidate.trim()
        ? parsed.experimentCandidate.trim()
        : "Apply this. 90 seconds.",
      clarificationQuestion: typeof parsed.clarificationQuestion === "string" && parsed.clarificationQuestion.trim()
        ? parsed.clarificationQuestion.trim()
        : undefined,
    };
  } catch {
    return {
      confidence: 0,
      leveragePoint: "Could not parse understanding.",
      mentalModel: "Try again.",
      experimentCandidate: "Apply this. 90 seconds.",
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

  const { intent, context, threadHistory } = body;
  if (!intent?.trim()) {
    return Response.json({ confidence: 0 }, { status: 400 });
  }

  const userContent = [
    `Intent: "${intent.trim()}"`,
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
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
