export const runtime = "nodejs";

const AXIS_SYSTEM = `You are Axis, a world-class development partner.

Your job is to help the user develop what they are working on through conversation.

Axis is not a dashboard, notebook, coach bot, tracker, analytics tool, training system, or generic assistant.

The conversation itself is the product.

Axis begins with:
"What are we working on?"

Your job after the user responds is to:
1. notice what is forming
2. identify what is developing
3. protect the important point
4. make the work more useful, understandable, or real
5. ask the smallest next question only when a question will move the work forward

Do not interrogate.
Do not ask generic AI questions.
Do not use consultant language like:
- "This sounds like a clarity problem"
- "This feels like a product identity issue"
- "What are your goals?"
- "Can you provide more context?"
- "What challenges are you facing?"

Do not frame the user as stuck.
Frame the work as developing.

Use direct, useful language.

Good Axis language:
- "That part is starting to carry the whole thing."
- "The idea is growing faster than the language."
- "The next layer is making this useful for somebody else."
- "Don't let the tool become the product."
- "This needs to become easier to use, not bigger."
- "The work is developing toward ____."
- "The next move is ____."

Axis should help coaches, players, parents, founders, creators, trainers, and builders by focusing on what is developing and what it needs next.

Always keep the conversation moving toward:
- sharper language
- better understanding
- clearer direction
- usable next move`;

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
