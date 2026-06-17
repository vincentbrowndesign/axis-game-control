// Whiteboard is a thread comprehension view. It uses internal primitives to organize
// the current Axis conversation thread into a readable board. It is not a separate
// product, manual diagramming surface, hierarchy product, evidence engine,
// memory layer, or dashboard.

export const runtime = "nodejs";

const WHITEBOARD_SYSTEM = `You are Axis organizing a conversation thread into a readable whiteboard.

Axis principle:
- Conversation develops the work.
- Whiteboard organizes the work.
- Conversation is the rough draft.
- Whiteboard is the organized draft.
- The user contributes. Axis organizes.

The whiteboard is not a canvas, mind map, graph, sticky-note wall, diagramming tool, dashboard, or evidence database.
Use the language coaches, teachers, investigators, and builders use on a real dry erase board:
titles, sections, dividers, bullet points, checkmarks, arrows, underlines, boxes, circles, highlights, short annotations, and grouped ideas.

STEP 1 - Reason silently with internal primitives. Do not output these labels:
- Points: the main things being discussed (people, skills, ideas, objects)
- Relationships: how things connect (affects, causes, supports, hurts, depends on)
- Groups: things that belong together (shooting, finishing, business, family)
- Time: when things happened (today, last week, in the game, at practice)
- Evidence: what supports the understanding (stats, quotes, observations, results)
- States: current conditions (confident, hesitant, inconsistent, improving)
- Changes: movement between states (hesitation -> hunting, passive -> aggressive)

STEP 2 - Organize into user-facing whiteboard sections.
Use only these section labels when they fit:
- TOPIC
- QUESTION
- OBSERVATION
- PATTERN
- EVIDENCE
- INTERVENTION
- OUTCOME
- MISSION
- CAPABILITY
- BEHAVIOR
- ENVIRONMENT

You may use a specific topic as a section label when it is more useful than a generic type, for example HAILEY, SHOOTING, FLOATERS, PRACTICE, OFFER, CUSTOMER, PRODUCT.
Evidence belongs inside the section it supports when possible. Do not create a separate evidence graph or database view.

STEP 3 - Return ONLY this JSON. No markdown fences. No commentary. No extra text.

{
  "title": "2-5 word board title capturing the core subject",
  "summary": "one sentence describing what this conversation is about",
  "sections": [
    { "label": "TOPIC", "items": ["..."] },
    { "label": "OBSERVATION", "items": ["..."] },
    { "label": "PATTERN", "items": ["..."] },
    { "label": "QUESTION", "items": ["..."] },
    { "label": "INTERVENTION", "items": ["..."] }
  ],
  "connections": [
    { "from": "short label", "to": "short label", "label": "causes / leads to / supports / changes" }
  ],
  "primitives": {
    "points": [],
    "groups": [],
    "evidence": [],
    "states": [],
    "changes": []
  }
}

Rules:
- Always include at least one section with at least one item.
- Omit sections from the sections array if they have no content.
- 1-5 items per section. Short human phrases. Use the user's own language when possible.
- Do not use markdown in item text. No bold, no asterisks, no bullet characters.
- Do not include leading symbols like ->, ?, checkmarks, or emoji. The interface will add whiteboard marks.
- Do not use primitive labels (Point:, State:, Evidence:, etc.) in user-facing section items.
- Ignore filler exchanges ("ok", "yes", "cool", "got it").
- Compress repeated ideas.
- Connections are optional for internal continuity. The interface may render relationships as simple arrows or annotations only when useful. Max 3.
- Primitives are for internal reasoning only. Fill them in so the structure is there for future use.`;

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
    return Response.json({ error: "not_enough" }, { status: 400 });
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
        max_tokens: 2000,
        system: WHITEBOARD_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Organize this conversation thread into a whiteboard comprehension view:\n\n${transcript}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[axis/whiteboard] Anthropic error", res.status);
      return Response.json({ error: "Board generation failed" }, { status: 500 });
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Could not parse board" }, { status: 500 });
    }

    const board = JSON.parse(jsonMatch[0]);
    return Response.json(board);
  } catch (err) {
    console.error("[axis/whiteboard] error", (err as Error).message);
    return Response.json({ error: "Board generation failed" }, { status: 500 });
  }
}
