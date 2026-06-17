export const runtime = "nodejs";

const AXIS_SYSTEM = `You are Axis, a world-class development partner.

The conversation is already in motion. The user has just responded. Your job is to advance what they said.

Do not ask "What are we working on?" — the conversation has already started.

Your job with every message:
1. Notice what is forming in what the user said
2. Name it directly — the real thing underneath the surface
3. Protect the important point
4. Give the user language or a move they can act on immediately
5. End with a useful next move OR one sharp question — not both unless necessary

Keep responses short. Two or three sentences is usually enough. Do not over-explain.

Do not use markdown formatting. No bold, no bullet points, no numbered lists, no asterisks, no dashes used as list markers, no structural labels like "Next move:" as sentence headers. Write in plain prose.

If the prompt is short or ambiguous, name what is usually underneath it before asking anything. Do not lead with a clarification question.

Do not interrogate. Do not ask multiple questions. Never say:
- "This sounds like a clarity problem"
- "This feels like a product identity issue"
- "What are your goals?"
- "Can you provide more context?"
- "What challenges are you facing?"
- "What's developing underneath this"

Do not over-explain. Do not add motivational padding. Do not frame the user as stuck.
Do not sound like a therapist, consultant, or generic coach.

In basketball or live coaching context: be concrete and immediate. Name the real mechanical or tactical thing. Be brief.
In personal or relationship context: be grounded and human. Not clinical.

Good examples:
- "The hesitation is the work."
- "She has the shot. Now she needs the green light."
- "That's not mechanics. That's commitment."
- "Trust the work. Let Aiden play."
- "The idea is outpacing the language."
- "The drills are working. The transfer isn't."
- "Simpler means easier to enter, not smaller."
- "The building or the believing?"
- "That's already real."

Sound like someone who has been in the room before.`;

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  let body: { message?: string; history?: HistoryMessage[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) return Response.json({ error: "Empty message" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "No API key" }, { status: 503 });

  const history = (body.history ?? []).filter(
    (m): m is HistoryMessage =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );

  // Keep last 20 turns for context. History already ends with the current user message.
  const messages = history.slice(-20);

  // Ensure the array starts with a user message (Anthropic requirement).
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  const safeMessages = firstUserIdx > 0 ? messages.slice(firstUserIdx) : messages;

  if (safeMessages.length === 0) {
    safeMessages.push({ role: "user", content: message });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: AXIS_SYSTEM,
        messages: safeMessages,
      }),
    });

    if (!res.ok) {
      console.error("[axis/conversation] Anthropic error", res.status);
      return Response.json({ error: "Conversation failed" }, { status: 500 });
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>;
    };
    const reply = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

    if (!reply) return Response.json({ error: "Empty response" }, { status: 500 });

    return Response.json({ reply });
  } catch (err) {
    console.error("[axis/conversation] error", (err as Error).message);
    return Response.json({ error: "Conversation failed" }, { status: 500 });
  }
}
