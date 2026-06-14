import OpenAI from "openai";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Expansion API — Intent → Clarification Question OR Constraint
//
// Two call patterns:
//   POST { intent }          → { confidence, clarification_question? | constraint? }
//   POST { intent, answer }  → { confidence: 1.0, constraint }
//
// Used by the Expansion Engine in the shell.
// The LLM locates the leverage point and either asks one intelligent
// question or produces a constraint directly.
// ---------------------------------------------------------------------------

interface ExpandRequest {
  intent: string;
  answer?: string;
}

interface ExpandResponse {
  confidence: number;
  clarification_question?: string;
  constraint?: string;
}

// Tight prompt — question or constraint only, no coaching, no essays
const EXPANSION_SYSTEM = `You are the Axis coaching intelligence. Your only job: locate the leverage point in a basketball player's development and either ask one precise question or assign a constraint.

Given the player's intent:

If clear enough (confidence ≥ 0.75): assign a constraint.
Format: "[Action]." — 1 imperative sentence. Specific and observable. No time appended.
Example: "Keep your eyes up through every dribble."

If ambiguous (confidence < 0.75): ask ONE clarifying question.
Name 2–3 specific sub-problems from that domain. Prove you understand the game.
BAD: "What part?" / "Tell me more." / "What's your goal?"
GOOD: "Pressure, eyes up, or changing pace?"
GOOD: "Reading the hedge, getting downhill, or finding the roller?"
GOOD: "Is contact, touch, or timing causing the miss?"

Few-shot examples:
"eyes up" → {"confidence":0.95,"constraint":"Keep your eyes up through every dribble."}
"handles" → {"confidence":0.35,"clarification_question":"Pressure, eyes up, or changing pace?"}
"pick and roll" → {"confidence":0.30,"clarification_question":"Reading the hedge, getting downhill, or finding the roller?"}
"finishing at the rim" → {"confidence":0.45,"clarification_question":"Is it contact, your off hand, or getting to your spot?"}
"finishing at the rim with contact" → {"confidence":0.88,"constraint":"Finish through contact without slowing down."}
"moving without the ball" → {"confidence":0.35,"clarification_question":"Getting open, timing your cuts, or creating space?"}
"weak hand layup" → {"confidence":0.90,"constraint":"Finish with the left hand only."}
"defense" → {"confidence":0.28,"clarification_question":"On-ball pressure, help rotations, or closeouts?"}
"vision" → {"confidence":0.30,"clarification_question":"Finding open teammates, reading the defense, or pre-catch awareness?"}

No coaching. No explanation. No multiple questions. No time limits. JSON only.`;

const CONSTRAINT_SYSTEM = `You are the Axis coaching intelligence. A player stated their intent and answered your question. Assign one constraint.

Format: "[Action]." — 1 imperative sentence. Specific, observable, constraint-based. No time appended.
Examples: "Pocket pass only." / "Finish through contact without slowing down." / "Stay connected on the catch."

No time limits. No explanations. JSON only.`;

function safeParse(raw: string): ExpandResponse {
  try {
    const start = raw.indexOf("{");
    const text = start >= 0 ? raw.slice(start) : raw;
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      clarification_question:
        typeof parsed.clarification_question === "string" && parsed.clarification_question.trim()
          ? parsed.clarification_question.trim()
          : undefined,
      constraint:
        typeof parsed.constraint === "string" && parsed.constraint.trim()
          ? parsed.constraint.trim()
          : undefined,
    };
  } catch {
    return { confidence: 0 };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ confidence: 0 }, { status: 503 });
  }

  let body: ExpandRequest;
  try {
    body = (await req.json()) as ExpandRequest;
  } catch {
    return Response.json({ confidence: 0 }, { status: 400 });
  }

  const intent = body.intent?.trim();
  const answer = body.answer?.trim();

  if (!intent) {
    return Response.json({ confidence: 0 }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      max_tokens: 120,
      messages: answer
        ? [
            { role: "system", content: CONSTRAINT_SYSTEM },
            { role: "user", content: `Intent: ${intent}\nAnswer: ${answer}` },
          ]
        : [
            { role: "system", content: EXPANSION_SYSTEM },
            { role: "user", content: intent },
          ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    console.error("[axis/expand]", err);
    return Response.json({ confidence: 0 }, { status: 500 });
  }
}
