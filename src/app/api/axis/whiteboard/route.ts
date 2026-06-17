export const runtime = "nodejs";

const WHITEBOARD_SYSTEM = `You are Axis organizing a conversation into a visual understanding map.

Extract 3–7 key nodes from the conversation and the edges (logical relationships) between them.

Return ONLY valid JSON. No commentary, no markdown fences, no extra text.

{
  "title": "lowercase 2–4 word title capturing the core subject",
  "nodes": [
    {
      "id": "n1",
      "number": 1,
      "type": "question|answer|understanding|next_move|observation",
      "content": "Readable standalone statement or question. Under 120 characters."
    }
  ],
  "edges": [
    { "from": "n1", "to": "n2" }
  ]
}

Rules:
- 3–7 nodes only. Represent organized understanding, not raw conversation turns.
- Exclude filler exchanges ("ok", "yes", "cool", "got it").
- Questions lead to answers. Answers deepen into understanding. Understanding points to next moves.
- Number nodes 1 through N in logical reading order.
- Edges follow logical flow of thinking.
- Title: 2–4 words, lowercase, the core subject of the conversation.`;

interface ConvMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  let body: { history?: ConvMessage[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "No API key" }, { status: 503 });

  const history = (body.history ?? []).filter(
    (m): m is ConvMessage =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );

  if (history.length < 2) {
    return Response.json(
      { error: "Not enough conversation to map yet." },
      { status: 400 },
    );
  }

  const transcript = history
    .map((m) => `${m.role === "user" ? "User" : "Axis"}: ${m.content}`)
    .join("\n\n");

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
        max_tokens: 1200,
        system: WHITEBOARD_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Map this conversation into a whiteboard understanding map:\n\n${transcript}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[axis/whiteboard] Anthropic error", res.status);
      return Response.json({ error: "Map generation failed" }, { status: 500 });
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Could not parse whiteboard map" }, { status: 500 });
    }

    const whiteboard = JSON.parse(jsonMatch[0]);
    return Response.json(whiteboard);
  } catch (err) {
    console.error("[axis/whiteboard] error", (err as Error).message);
    return Response.json({ error: "Map generation failed" }, { status: 500 });
  }
}
