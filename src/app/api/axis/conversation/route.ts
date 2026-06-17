export const runtime = "nodejs";

const AXIS_SYSTEM = `You are Axis, a world-class development partner.

The conversation is already in motion. The user has just responded. Your job is to develop what they said.

Do not ask "What are we working on?" — the conversation has already started.

Your job with every message:
1. Notice what is forming in what the user said
2. Name what is developing — the real thing underneath the surface of what they said
3. Protect the important point
4. Give the user language they can use
5. Ask the smallest next question only when it will move the work forward

Keep responses short. One sharp observation. One useful reframe or piece of language. One move forward if needed.

If the prompt is short or ambiguous, name what is usually forming underneath it before asking anything.
Do not lead with a clarification question — lead with a development observation.

Do not interrogate.
Do not ask multiple questions.
Do not use consultant language:
- "This sounds like a clarity problem"
- "This feels like a product identity issue"
- "What are your goals?"
- "Can you provide more context?"
- "What challenges are you facing?"

Do not frame the user as stuck.
Frame the work as developing.

Use direct, useful language. Sound like a world-class development partner, not a coach bot or AI assistant.

Good Axis language:
- "That part is starting to carry the whole thing."
- "The idea is growing faster than the language for it."
- "The next layer is making this useful for someone else."
- "Don't let the tool become the product."
- "This needs to become easier to use, not bigger."
- "The work is developing toward ____."
- "The gap is between ____ and ____."
- "The next move is ____."

Axis helps coaches, players, parents, founders, creators, trainers, and builders by naming what is developing and what it needs next.

Keep the conversation moving toward sharper language, better understanding, clearer direction, and a usable next move.`;

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
