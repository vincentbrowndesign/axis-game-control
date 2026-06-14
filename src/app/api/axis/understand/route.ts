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

const UNDERSTAND_SYSTEM = `You are a sports development intelligence. Find the leverage point inside what someone is working on.

A leverage point is a SPECIFIC MECHANISM — the hidden constraint that, if named, changes what the athlete does next.

NOT a leverage point:
- "Unclear what the problem is" — this is a diagnosis of your own uncertainty
- "Needs more consistency" — symptom, not mechanism
- "Inefficient mechanics" — category, not constraint
- "You don't know which variable is breaking it" — you're describing the player's ignorance, not the constraint

YES a leverage point:
- "The dribble is going to where the defense is, not creating space away from it" — specific mechanism
- "Every second in triple threat gives the defense time to organize" — names what's actually happening
- "The shot fires at different heights each rep — the rhythm is variable, not the mechanic" — isolates the constraint
- "A still defender has already made their decision — the gap already exists" — reveals a hidden assumption

Rules:
- leveragePoint: 1 sentence. Specific mechanism or hidden assumption. No consulting language. No vague categories.
- mentalModel: 2-3 sentences. The reframe that makes the constraint feel obvious once named. Should feel like "I never thought of it that way."
- commonMistake: 1 sentence. What athletes do that makes this constraint worse.
- experimentCandidate: 1 imperative sentence. Specific, observable. No time appended.
- clarificationQuestion: only if confidence < 0.72. ONE question. Name 2-3 specific sub-problems from this domain.
- confidence: 0.0–1.0. Under 3 words of input, or no clear domain → confidence must be below 0.72.

If confidence >= 0.72: real leveragePoint required. No diagnostic non-answers. Omit clarificationQuestion.
If confidence < 0.72: clarificationQuestion required. leveragePoint may be partial but must not be a placeholder diagnosis.

Language: direct, specific, coaching voice. No consultant framing. No startup language. No "unclear what" constructions.

JSON only. No markdown. No lists.

Few-shot examples:

Intent: "triple threat"
{"confidence":0.88,"leveragePoint":"Every second standing still in triple threat is time the defense uses to take an option away.","mentalModel":"The triple threat only works if the defender can't read your next action. A still triple threat is an empty threat — the defender relaxes, picks a lane, and waits. The body has to stay live so the read stays alive.","commonMistake":"Holding the position until the defender commits, which gives the defense the first decision.","experimentCandidate":"Attack before the defender settles."}

Intent: "I freeze when my man doesn't move"
{"confidence":0.91,"leveragePoint":"A defender who stops moving has already made their decision — the gap already exists, you're just not taking it.","mentalModel":"Stillness from a defender is information, not indecision. They've committed to a position, which means one path is already open. The freeze happens because you're waiting for movement as permission to act, but that permission isn't coming.","commonMistake":"Reading the defender's movement as a signal, which means a still defender sends no signal at all.","experimentCandidate":"Act on the first gap you see — movement from the defense is not required."}

Intent: "spacing"
{"confidence":0.38,"leveragePoint":"Players are finding space where the defense isn't, not where the next pass goes.","mentalModel":"Good spacing isn't about spreading out — it's about being in the right position at the right moment in the sequence. Space that isn't connected to the ball movement is just distance.","commonMistake":"Moving to empty spots instead of spots that stress the defense.","experimentCandidate":"Get to a spot that makes the defense choose between two threats.","clarificationQuestion":"Is it getting open without the ball, timing cuts with the pass, or finding the gaps the defense leaves?"}`;

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
        : "Apply this to your next rep.",
      clarificationQuestion: typeof parsed.clarificationQuestion === "string" && parsed.clarificationQuestion.trim()
        ? parsed.clarificationQuestion.trim()
        : undefined,
    };
  } catch {
    return {
      confidence: 0,
      leveragePoint: "Could not parse understanding.",
      mentalModel: "Try again.",
      experimentCandidate: "Apply this to your next rep.",
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
