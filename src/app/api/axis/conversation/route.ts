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
- Short gym phrases are not too thin. Treat them as the thread title and make a useful first split.
- For one-word prompts like "jumpshot", "the shot", or "footwork", do not ask what the user means. Give the first useful read.
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
- Include threadBoard when there is enough signal to organize. Short gym phrases are enough signal for a compact board.
- The title should be the clearest thread name, not a generic label.
- The summary should say what the thread is about in plain language.
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
- "What about [topic] do you want to work on?"
- "What aspect of [topic] do you want to focus on?"

Internal behavior pattern:
- Catch: identify the rough topic.
- Develop: name the useful split or pressure point.
- Return: give the user language they can use.
- Move: offer the next useful action or one sharp question.
- Never show these words to the user.

Good reply examples:
- "Footwork is the entry point. The useful split is whether the player is losing organization before the catch, before the attack, or before the finish. Keep the thread on the moment where the feet decide the next action."
- "The shot is too broad as a drill label, but it is useful as a thread title. The first split is whether the miss is coming from setup, timing, or decision pressure."
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

function hasMarkdown(text: string) {
  return /```|^#{1,6}\s|^\s*[-*]\s|^\s*\d+\.\s|\*\*/m.test(text);
}

function isGenericClarification(reply: string) {
  const clean = reply.toLowerCase();
  return [
    /can you provide more context/,
    /what are your goals/,
    /what challenges are you facing/,
    /what about .+ do you want/,
    /what aspect of .+ do you want/,
    /could you clarify/,
    /can you clarify/,
    /tell me more about/,
  ].some((pattern) => pattern.test(clean));
}

function isValidReply(reply: string) {
  return Boolean(reply) &&
    !hasRawArrow(reply) &&
    !hasMarkdown(reply) &&
    !isGenericClarification(reply);
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
    .filter((section): section is ThreadBoardSection => section !== null)
    .slice(0, 4);

  if (sections.length === 0) return null;

  return { title, summary, sections };
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function createFallbackResponse(message: string): { reply: string; threadBoard: ThreadBoard } {
  const normalized = message.toLowerCase().replace(/\s+/g, " ").trim();

  if (normalized.includes("footwork")) {
    return {
      reply: "Footwork is the entry point. The useful split is whether the player is losing organization before the catch, before the attack, or before the finish. Keep the thread on the moment where the feet decide the next action.",
      threadBoard: {
        title: "Footwork",
        summary: "The thread is about how the player gets organized before action.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["Footwork is the working topic"],
          },
          {
            type: "pattern",
            label: "Pattern",
            items: ["The key moment is before the action starts"],
          },
          {
            type: "intervention",
            label: "Intervention",
            items: ["Separate catch setup, attack setup, and finish setup"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Identify which footwork moment is costing possessions"],
          },
        ],
      },
    };
  }

  if (normalized.includes("jumpshot") || normalized === "the shot" || normalized.includes(" shot")) {
    const title = normalized.includes("jumpshot") ? "Jumpshot" : "The Shot";
    return {
      reply: `${title} is the thread. The useful first split is setup, timing, and decision pressure, because each one breaks the shot in a different way. Start by naming which moment changes the result most often.`,
      threadBoard: {
        title,
        summary: "The thread is about where the shot is breaking down or becoming reliable.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["The shot is the working topic"],
          },
          {
            type: "relationship",
            label: "Relationship",
            items: ["Setup, timing, and decision pressure each change the shot"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Name the moment that changes the result most often"],
          },
        ],
      },
    };
  }

  if (normalized.includes("hailey")) {
    return {
      reply: "Hailey is the thread now. Twelve points gives the performance marker, but the useful work is identifying which scoring action should become more intentional. Keep the thread on what she already has that she is not using enough.",
      threadBoard: {
        title: "Hailey",
        summary: "The thread is about turning a scoring signal into a clearer next emphasis.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["Hailey had 12 points"],
          },
          {
            type: "hypothesis",
            label: "Hypothesis",
            items: ["There may be an existing scoring action to use more often"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Find the action that should become more intentional"],
          },
        ],
      },
    };
  }

  if (normalized.includes("floater") || normalized.includes("hesitation")) {
    return {
      reply: "The floater is not the problem; the hunt is. She already trusts the shot enough for it to be useful, so the thread should stay on getting her to recognize and take it before the defense resets.",
      threadBoard: {
        title: "Floaters",
        summary: "The thread is about turning an existing shot into a more intentional scoring choice.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["The floater is a shot she can make"],
          },
          {
            type: "pattern",
            label: "Pattern",
            items: ["She hesitates instead of hunting it"],
          },
          {
            type: "relationship",
            label: "Relationship",
            items: ["Confidence in the shot is ahead of her decision to use it"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Make the floater the first read on lane touches"],
          },
        ],
      },
    };
  }

  const title = titleCase(message.slice(0, 48));
  return {
    reply: `${title || "This"} is enough to start the thread. The useful move is to name what is happening, what pattern might be forming, and what would change the next rep or decision.`,
    threadBoard: {
      title: title || "Current Thread",
      summary: "The thread has a rough topic that needs its first useful structure.",
      sections: [
        {
          type: "observation",
          label: "Observation",
          items: [message],
        },
        {
          type: "question",
          label: "Question",
          items: ["What moment changes the next action most"],
        },
        {
          type: "outcome",
          label: "Outcome / Next Move",
          items: ["Name the first useful split"],
        },
      ],
    },
  };
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

      if (!isValidReply(reply)) {
        return Response.json(createFallbackResponse(message));
      }

      const threadBoard = validateThreadBoard(parsed.threadBoard);
      const fallback = threadBoard ? null : createFallbackResponse(message);

      return Response.json({
        reply,
        threadBoard: threadBoard ?? fallback?.threadBoard ?? null,
      });
    } catch {
      if (isValidReply(text)) {
        return Response.json({
          reply: text,
          threadBoard: createFallbackResponse(message).threadBoard,
        });
      }

      return Response.json(createFallbackResponse(message));
    }
  } catch (err) {
    console.error("[axis/conversation] error", (err as Error).message);
    return Response.json({ error: "Conversation failed" }, { status: 500 });
  }
}
