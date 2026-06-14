export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Mental Model Engine
//
// Input:  { insight, reasoning? }
// Output: { mentalModel, rule, failurePattern, recognitionCue }
//
// Job: translate an insight into a transferable principle.
// Not drills. Not recommendations. A framework that holds across situations.
// ---------------------------------------------------------------------------

interface MentalModelRequest {
  insight: string;
  reasoning?: string;
}

export interface MentalModelResponse {
  mentalModel: string;
  rule: string;
  failurePattern: string;
  recognitionCue: string;
}

const MENTAL_MODEL_SYSTEM = `You are the Axis Mental Model Engine.

Your job: translate an insight into a transferable principle.

Do not provide drills.
Do not provide recommendations.
Do not provide instructions.

Create a framework that remains true across situations — not just this one.

Output fields:
- mentalModel: 2-3 sentences. One framework or principle. A way of seeing, not a way of acting. Must hold across different sports, players, and contexts.
- rule: 1 sentence. The principle distilled to its most transferable form. Memorable. Universal.
- failurePattern: 1 sentence. What consistently happens when this principle is ignored — the recognizable outcome of missing it.
- recognitionCue: 1 sentence. The specific observable moment in the environment when the player knows this principle applies right now.

Language: declarative. Present tense. No "try", "practice", "work on", "make sure". Principles, not prescriptions.

JSON only. No markdown.

Few-shot examples:

Insight: "Every second standing still in triple threat is time the defense uses to take an option away."
{"mentalModel":"Inaction is information. Every moment of stillness gives the defense time to process and eliminate options. The advantage exists only while the defense is still reading.","rule":"Motion is threat; stillness is permission.","failurePattern":"The player waits for the defender to commit first, which hands the first decision to the defense every time.","recognitionCue":"The defender stops lateral movement or relaxes their stance while you're holding the ball."}

Insight: "Players are finding space where the defense isn't — not where the next pass goes."
{"mentalModel":"Space is a relationship between time and ball position, not geography. An open spot that isn't connected to the next action in the sequence is distance — not an advantage. The space that matters is the one that will be occupied at the right moment.","rule":"Space is only useful when it aligns with when the ball arrives.","failurePattern":"Players arrive in open space too early or too late, so the gap closes before it can be used.","recognitionCue":"You're open but the ball isn't moving toward you and no one is under defensive pressure."}

Insight: "You're using vision as the control mechanism — when pressure spikes, your eyes drop back to the ball because your hands haven't built enough tactile feedback to run the dribble without visual confirmation."
{"mentalModel":"Any skill that requires visual confirmation to function will break under attentional load. The eyes are a limited resource — when decisions compete for them, the control loop that depends on them collapses first.","rule":"A skill owned by the eyes is a skill lost under pressure.","failurePattern":"The player's execution degrades precisely when it's needed most, because pressure redirects the visual resource that the skill depends on.","recognitionCue":"You notice your eyes are on the ball at the moment a decision or threat appears."}`;

function safeParse(raw: string): MentalModelResponse {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;
    return {
      mentalModel: typeof parsed.mentalModel === "string" && parsed.mentalModel.trim()
        ? parsed.mentalModel.trim()
        : "A principle that holds across situations.",
      rule: typeof parsed.rule === "string" && parsed.rule.trim()
        ? parsed.rule.trim()
        : "The constraint is always present.",
      failurePattern: typeof parsed.failurePattern === "string" && parsed.failurePattern.trim()
        ? parsed.failurePattern.trim()
        : "The outcome degrades in a recognizable way.",
      recognitionCue: typeof parsed.recognitionCue === "string" && parsed.recognitionCue.trim()
        ? parsed.recognitionCue.trim()
        : "The constraint becomes visible in the environment.",
    };
  } catch {
    return {
      mentalModel: "Could not generate mental model.",
      rule: "Try again.",
      failurePattern: "",
      recognitionCue: "",
    };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ mentalModel: "" }, { status: 503 });
  }

  let body: MentalModelRequest;
  try {
    body = await req.json() as MentalModelRequest;
  } catch {
    return Response.json({ mentalModel: "" }, { status: 400 });
  }

  const { insight, reasoning } = body;
  if (!insight?.trim()) {
    return Response.json({ mentalModel: "" }, { status: 400 });
  }

  const userContent = [
    `Insight: "${insight.trim()}"`,
    reasoning?.trim() ? `Reasoning: ${reasoning.trim()}` : null,
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
        system: MENTAL_MODEL_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/mental-model]", response.status, errText);
      return Response.json({ mentalModel: "" }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/mental-model]", e.message);
    return Response.json({ mentalModel: "" }, { status: 500 });
  }
}
