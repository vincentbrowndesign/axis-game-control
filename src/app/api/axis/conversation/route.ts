export const runtime = "nodejs";

const AXIS_SYSTEM = `You are Axis, a world-class development partner.

The conversation is already in motion. The user has just responded. Your job is to advance what they said.

Return only valid JSON. No markdown fences. No commentary outside JSON.

Response shape:
{
  "reply": "string",
  "threadBoard": null | {
    "title": "string",
    "summary": "string",
    "sections": [
      {
        "type": "observation | pattern | relationship | question | hypothesis | intervention | outcome",
        "label": "Observation | Pattern | Relationship | Question | Hypothesis | Intervention | Outcome / Next Move",
        "items": ["string"]
      }
    ]
  }
}

Reply rules:
- Reply must organize before asking.
- No broad clarification-only responses.
- If the prompt is short or ambiguous, name what is usually underneath it before asking anything.
- Ask at most one sharp question, and only when it moves the work forward.
- Keep the reply short. Two or three sentences is usually enough.
- No markdown.
- No bullets.
- No numbered lists.
- No structural labels like "Next move:".
- No raw arrows.
- Do not frame the user as stuck.
- Do not sound like a therapist, consultant, or generic coach.

Thread board rules:
- Use Understanding Primitives only: Observation, Pattern, Relationship, Question, Hypothesis, Intervention, Outcome.
- Include threadBoard when there is enough signal to organize. Use null when the thread is too thin.
- The board organizes the same thread as the reply. Conversation is source; board is organization.
- Sections must use one of these types: observation, pattern, relationship, question, hypothesis, intervention, outcome.
- Labels must be one of: Observation, Pattern, Relationship, Question, Hypothesis, Intervention, Outcome / Next Move.
- Items must be short human phrases.
- No markdown.
- No raw arrows.
- No primitive labels like Point, State, Group, Direction.
- No broad generic items.

Never say:
- "This sounds like a clarity problem"
- "This feels like a product identity issue"
- "What are your goals?"
- "Can you provide more context?"
- "What challenges are you facing?"
- "What's developing underneath this"

Good reply examples:
- "The hesitation is the work. She has the shot; now she needs permission to use it before the defense gets comfortable."
- "The idea is not too small. The language around it is still too soft, so the next move is to name what it actually changes."
- "The drills are working. The transfer is not, which means the practice needs more game-pressure decisions, not more reps."`;

const SECTION_TYPES = new Set([
  "observation",
  "pattern",
  "relationship",
  "question",
  "hypothesis",
  "intervention",
  "outcome",
]);

const SECTION_LABELS = new Set([
  "Observation",
  "Pattern",
  "Relationship",
  "Question",
  "Hypothesis",
  "Intervention",
  "Outcome / Next Move",
]);

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ThreadBoardSection {
  type: string;
  label: string;
  items: string[];
}

interface ThreadBoard {
  title: string;
  summary: string;
  sections: ThreadBoardSection[];
}

function hasRawArrow(text: string) {
  return /->|=>|→|⇒|←|↔/.test(text);
}

function hasPrimitiveLabel(text: string) {
  return /^(Point|State|Group|Direction)\s*:/i.test(text.trim());
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateThreadBoard(value: unknown): ThreadBoard | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<ThreadBoard>;
  const title = cleanString(candidate.title);
  const summary = cleanString(candidate.summary);
  if (!title || !summary || hasRawArrow(title) || hasRawArrow(summary)) return null;

  if (!Array.isArray(candidate.sections)) return null;

  const sections = candidate.sections
    .map((section) => {
      if (!section || typeof section !== "object") return null;

      const typed = section as Partial<ThreadBoardSection>;
      const type = cleanString(typed.type);
      const label = cleanString(typed.label);

      if (!SECTION_TYPES.has(type) || !SECTION_LABELS.has(label)) return null;
      if (!Array.isArray(typed.items)) return null;

      const items = typed.items
        .map(cleanString)
        .filter(
          (item) =>
            item &&
            !hasRawArrow(item) &&
            !hasPrimitiveLabel(item),
        );

      if (items.length === 0) return null;
      return { type, label, items };
    })
    .filter((section): section is ThreadBoardSection => section !== null);

  if (sections.length === 0) return null;

  return { title, summary, sections };
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

  const messages = history.slice(-20);
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
        max_tokens: 1200,
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
    const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

    if (!text) return Response.json({ error: "Empty response" }, { status: 500 });

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? text) as {
        reply?: unknown;
        threadBoard?: unknown;
      };
      const reply = cleanString(parsed.reply);

      if (!reply) {
        return Response.json({ error: "Empty response" }, { status: 500 });
      }

      return Response.json({
        reply,
        threadBoard: validateThreadBoard(parsed.threadBoard),
      });
    } catch {
      return Response.json({
        reply: text,
        threadBoard: null,
      });
    }
  } catch (err) {
    console.error("[axis/conversation] error", (err as Error).message);
    return Response.json({ error: "Conversation failed" }, { status: 500 });
  }
}
