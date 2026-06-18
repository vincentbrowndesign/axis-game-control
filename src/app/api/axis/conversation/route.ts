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
        "label": "Observation | Pattern | Relationship | Question | Hypothesis | Intervention | Outcome / Next Move | TIMEOUT CALL | PLAYER RULE | WATCH NEXT | ADJUSTMENT TRIGGER",
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
- Rough creative, practice, content, or business inputs are also enough to organize. Name the working surface and the first useful split.
- If the user asks for an in-game play, give one concrete tactical adjustment and make the board about that adjustment.
- If the user is in live pressure, give the call before asking for context.
- If a live-pressure thread continues with a short update like "Rebounding", "too many chances", or "Ball watching", treat it as sideline context and return a compact call sheet.
- If the user asks how to make a site better, make the first split concrete: readability, input speed, board usefulness, mobile friction.
- If the user is watching, thinking, saying something "looks like", "maybe", or "notional", treat it as a possible read, not a fact.
- If the user is talking about Axis itself, protect the current MVP: text conversation, understanding primitives, inline Thread Board, gym-readable use.
- For Axis product inputs, do not give startup advice, device advice, fundraising advice, positioning advice, or future-layer advice.
- Do not merge adjacent facts into invented evidence. If the user says "Hailey had 12 points" and then mentions floaters, do not claim the 12 points came from floaters unless the user says that.
- Do not upgrade speculation into fact. Practice observations, contender reads, or rough takes must stay framed as possible reads unless evidence is named.
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
- Each section should stand on its own as one compact piece of understanding.
- Sections must use one of these types: observation, pattern, relationship, question, hypothesis, intervention, outcome.
- Labels must be one of: Observation, Pattern, Relationship, Question, Hypothesis, Intervention, Outcome / Next Move.
- In live-pressure game contexts only, labels may also be: TIMEOUT CALL, PLAYER RULE, WATCH NEXT, ADJUSTMENT TRIGGER.
- Items must be short human phrases.
- No markdown.
- No raw arrows.
- No primitive labels like Point, State, Group, Direction.
- No broad generic items.
- No future-layer items for Axis MVP threads.

Never say:
- "This sounds like a clarity problem"
- "This feels like a product identity issue"
- "What are your goals?"
- "Can you provide more context?"
- "What challenges are you facing?"
- "What's developing underneath this"
- "What about [topic] do you want to work on?"
- "What aspect of [topic] do you want to focus on?"
- "Does it need a different form?"
- "What is your target market?"
- "Who will pay for it?"
- "Tell me the team, level, and goal."
- "What are you seeing?"
- "Give me the first read."

Internal behavior pattern:
- Catch: identify the rough topic.
- Develop: name the useful split or pressure point.
- Return: give the user language they can use.
- Move: offer the next useful action or one sharp question.
- Never show these words to the user.

Good reply examples:
- "Making Axis real means proving the active loop first: rough gym language in, useful understanding out, Thread Board making the work easier to read. The boundary is not more features; it is whether the current conversation can hold up mid-session."
- "Adding too much is the pressure point. The work is to protect the smallest real loop: type the rough thought, get shape back, scan the Thread Board, and keep moving."
- "Suno is the creation surface. The useful split is whether the work is about song direction, prompt language, or choosing what is worth keeping."
- "Practice needs a simple room before it needs a system: what happened, what matters, and what the next session should make visible."
- "At a game, do not search for a perfect play. If they have one scorer carrying the offense, the fast adjustment is box-and-one principles: your best defender takes the scorer, the other four shrink the floor and force weaker decisions."
- "Call the timeout around second chances, not the whole defense. Every player names their man as the shot goes up, hits body first, finds ball second, and the guards crack back on long rebounds. If they get two more offensive boards, assign box-out matchups directly."
- "The site gets better through the surface, not a big redesign. Start with readability, input speed, board usefulness, and mobile friction."
- "That is a ceiling read, not a fact yet. The useful work is naming what practice evidence would make the contender claim real."
- "Footwork is the entry point. The useful split is whether the player is losing organization before the catch, before the attack, or before the finish. Keep the thread on the moment where the feet decide the next action."
- "The shot is too broad as a drill label, but it is useful as a thread title. The first split is whether the miss is coming from setup, timing, or decision pressure."
- "The hesitation is the work. She has the shot; now she needs permission to use it before the defense gets comfortable."
- "Hailey being passive against older competition is a pressure read, not a final judgment. The useful split is whether she is avoiding contact, rushing decisions, or waiting for permission before she attacks."
- "A private run with NBA players and Alijah Arenas is a live talent-read thread, not proof by itself. Track what survives against size, speed, and better decisions before naming the claim."
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
  "TIMEOUT CALL",
  "PLAYER RULE",
  "WATCH NEXT",
  "ADJUSTMENT TRIGGER",
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
    /tell me the team/,
    /tell me the player/,
  ].some((pattern) => pattern.test(clean));
}

function isAxisMvpInput(message: string) {
  const clean = message.toLowerCase();
  return clean.includes("axis") ||
    clean.includes("adding too much") ||
    clean.includes("work in the gym") ||
    clean.includes("gym first") ||
    clean.includes("business real") ||
    clean.includes("make this business real") ||
    clean.includes("make it real") ||
    clean.includes("make this real");
}

function isGamePlayInput(message: string) {
  const clean = message.toLowerCase();
  return clean.includes("at a game") && clean.includes("play");
}

function liveContext(message: string, context = "") {
  return `${context} ${message}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function isLivePressureInput(message: string) {
  const clean = liveContext(message);
  return /\b(game is starting|game starting|at a game|timeout|first timeout|give me a play|quick|right now|need a plan|rebounding|too many chances|second chances|offensive boards|ball watching)\b/i.test(clean);
}

function isFirstTimeoutInput(message: string) {
  const clean = liveContext(message);
  return /\b(game is starting|game starting|first timeout|timeout plan)\b/i.test(clean);
}

function isReboundingInput(message: string) {
  const clean = liveContext(message);
  return /\b(rebounding|too many chances|second chances|offensive boards|ball watching)\b/i.test(clean);
}

function isBallWatchingInput(message: string) {
  return /\bball watching\b/i.test(liveContext(message));
}

function isSecondChanceInput(message: string) {
  return /\b(too many chances|second chances|offensive boards)\b/i.test(liveContext(message));
}

function isSiteBetterInput(message: string) {
  const clean = message.toLowerCase();
  return clean.includes("site") && clean.includes("better");
}

function isBusinessRealInput(message: string) {
  return message.toLowerCase().includes("business real");
}

function isSpeculativeInput(message: string) {
  return /\b(watching|thinking|looks like|notional|maybe)\b/i.test(message);
}

function isMichiganPracticeInput(message: string) {
  const clean = message.toLowerCase();
  return clean.includes("michigan") && (clean.includes("practice") || clean.includes("notional"));
}

function isSunoInput(message: string) {
  return message.toLowerCase().includes("suno");
}

function isHaileyPassiveInput(message: string) {
  const clean = message.toLowerCase();
  return clean.includes("hailey") && (clean.includes("passive") || clean.includes("older competition"));
}

function isPrivateRunInput(message: string) {
  const clean = message.toLowerCase();
  return clean.includes("private run") || (clean.includes("nba players") && clean.includes("alijah"));
}

function hasFutureLayerLeakage(reply: string) {
  return /\b(camera|voice|upload|mission|challenge|dashboard|memory|cv|replay|export|whiteboard mode|device|hardware|fundraising|market|startup|positioning|different form|first person who pays|who pays|customers?|business actually does)\b/i.test(reply);
}

function hasUnsupportedHaileyFloaterClaim(text: string) {
  return /hailey[^.]*12 points[^.]*floater|12 points[^.]*floater/i.test(text);
}

function hasSpeculationAsFact(text: string) {
  return /\b(is championship-level|are championship-level|championship-level|has cohesion|stay healthy|will win|is a contender|are contenders|notional champions are|practice quality is)\b/i.test(text);
}

function boardHasFutureLayerLeakage(board: ThreadBoard) {
  const text = [
    board.title,
    board.summary,
    ...board.sections.flatMap((section) => [
      section.type,
      section.label,
      ...section.items,
    ]),
  ].join(" ");

  return hasFutureLayerLeakage(text);
}

function boardHasUnsupportedClaim(board: ThreadBoard) {
  const text = [
    board.title,
    board.summary,
    ...board.sections.flatMap((section) => section.items),
  ].join(" ");

  return hasUnsupportedHaileyFloaterClaim(text) || hasSpeculationAsFact(text);
}

function isValidReply(reply: string) {
  return Boolean(reply) &&
    !hasRawArrow(reply) &&
    !hasMarkdown(reply) &&
    !isGenericClarification(reply) &&
    !hasUnsupportedHaileyFloaterClaim(reply) &&
    !hasSpeculationAsFact(reply);
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

  if (isBallWatchingInput(message)) {
    return {
      reply: "Call the timeout around second chances, not the whole defense. Every player names their man as the shot goes up, hits body first, finds ball second, and the guards crack back on long rebounds. If they get two more offensive boards, assign box-out matchups directly.",
      threadBoard: {
        title: "Offensive Rebounding: Ball Watching",
        summary: "Opponents are getting extra chances because defenders are watching the shot instead of finding bodies. The timeout correction is body first, ball second.",
        sections: [
          {
            type: "intervention",
            label: "TIMEOUT CALL",
            items: [
              "Stop second chances before changing the defense",
              "Every player names their man as the shot goes up",
            ],
          },
          {
            type: "intervention",
            label: "PLAYER RULE",
            items: [
              "Hit body first",
              "Find ball second",
              "Guards crack back on long rebounds",
            ],
          },
          {
            type: "question",
            label: "WATCH NEXT",
            items: [
              "Do they still get inside position",
              "Are long rebounds hurting the guards",
              "Does one matchup need help",
            ],
          },
          {
            type: "outcome",
            label: "ADJUSTMENT TRIGGER",
            items: ["If they still get two offensive boards after the timeout, assign box-out matchups directly"],
          },
        ],
      },
    };
  }

  if (isSecondChanceInput(message)) {
    return {
      reply: "Make the timeout about ending second chances. The call is body first, ball second: find someone on the shot, hit first contact, then pursue. If they still get two offensive boards after that, assign box-out matchups instead of asking everyone to rebound harder.",
      threadBoard: {
        title: "Offensive Rebounding: Second Chances",
        summary: "The live problem is extra possessions. The correction is to stop watching the ball and make first contact before chasing the rebound.",
        sections: [
          {
            type: "intervention",
            label: "TIMEOUT CALL",
            items: [
              "End the extra possessions",
              "Fix first contact before changing the defense",
            ],
          },
          {
            type: "intervention",
            label: "PLAYER RULE",
            items: [
              "Find a body on the shot",
              "Hit first contact",
              "Pursue after contact",
            ],
          },
          {
            type: "question",
            label: "WATCH NEXT",
            items: [
              "Are they winning inside position",
              "Are guards leaking out too early",
              "Is one matchup losing contact",
            ],
          },
          {
            type: "outcome",
            label: "ADJUSTMENT TRIGGER",
            items: ["Assign box-out matchups if the next two misses become offensive boards"],
          },
        ],
      },
    };
  }

  if (isReboundingInput(message)) {
    return {
      reply: "Keep the timeout simple: rebounding is contact before pursuit. Do not make it a hustle speech. Tell them to find a body on every shot, guards crack back on long rebounds, and the next two defensive possessions decide whether you assign matchups.",
      threadBoard: {
        title: "Timeout Plan: Rebounding",
        summary: "The immediate call is to turn rebounding from a loose effort message into a clear contact rule.",
        sections: [
          {
            type: "intervention",
            label: "TIMEOUT CALL",
            items: [
              "Rebounding is contact before pursuit",
              "No one watches the shot without finding a body",
            ],
          },
          {
            type: "intervention",
            label: "PLAYER RULE",
            items: [
              "Bigs own inside contact",
              "Guards crack back",
              "Pursue after the hit",
            ],
          },
          {
            type: "question",
            label: "WATCH NEXT",
            items: [
              "Who is missing first contact",
              "Are long rebounds beating the guards",
              "Are they getting clean runs from the weak side",
            ],
          },
          {
            type: "outcome",
            label: "ADJUSTMENT TRIGGER",
            items: ["Assign direct box-out matchups if the rule does not hold immediately"],
          },
        ],
      },
    };
  }

  if (isFirstTimeoutInput(message)) {
    return {
      reply: "Use the first timeout as a reset, not a lecture. Give them one call they can remember: settle the ball, win first contact, and get a clean shot in the next two possessions. Come back here with the first thing breaking and I will narrow the call.",
      threadBoard: {
        title: "First Timeout Call Sheet",
        summary: "The first timeout needs one clean correction the team can use immediately when the game starts moving fast.",
        sections: [
          {
            type: "intervention",
            label: "TIMEOUT CALL",
            items: [
              "Reset the group",
              "Name one correction",
              "Win the next two possessions",
            ],
          },
          {
            type: "intervention",
            label: "PLAYER RULE",
            items: [
              "Settle the ball",
              "Win first contact",
              "Get one clean shot",
            ],
          },
          {
            type: "question",
            label: "WATCH NEXT",
            items: [
              "Is the issue turnovers",
              "Is the issue rebounding",
              "Is the issue shot quality",
            ],
          },
          {
            type: "outcome",
            label: "ADJUSTMENT TRIGGER",
            items: ["Bring back the first thing breaking and narrow the next call"],
          },
        ],
      },
    };
  }

  if (isGamePlayInput(message)) {
    return {
      reply: "At a game, do not hunt for a perfect play first. If they have one scorer driving the offense, the fast adjustment is box-and-one principles: put your best defender on that scorer, then pack the other four into help so weaker decision-makers have to beat you.",
      threadBoard: {
        title: "Box-and-One Adjustment",
        summary: "The useful move is to isolate their main scorer with your best defender and make the rest of the team solve the game.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: [
              "The user needs a quick game adjustment",
              "There is one scorer worth isolating",
            ],
          },
          {
            type: "hypothesis",
            label: "Hypothesis",
            items: ["Taking away the best scorer forces weaker decision-makers to beat you"],
          },
          {
            type: "question",
            label: "Question",
            items: ["Can the other players pass, shoot, or punish the packed zone"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Put your best defender on their scorer and pack the other four in zone principles"],
          },
        ],
      },
    };
  }

  if (isSiteBetterInput(message)) {
    return {
      reply: "Make the site better by improving the surface people touch first. The first split is readability, input speed, board usefulness, and mobile friction. Start with the one that makes the work easier to understand in the first five seconds.",
      threadBoard: {
        title: "Site Surface Improvements",
        summary: "The first useful pass is about making the site faster to read, faster to use, and clearer on mobile.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["The site needs to feel more useful quickly"],
          },
          {
            type: "pattern",
            label: "Pattern",
            items: [
              "Readability controls trust",
              "Input speed controls whether people keep working",
              "Mobile friction breaks live use",
            ],
          },
          {
            type: "relationship",
            label: "Relationship",
            items: ["Board usefulness decides whether the page feels like work or decoration"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Choose the surface issue that improves the first five seconds"],
          },
        ],
      },
    };
  }

  if (isMichiganPracticeInput(message) || normalized.includes("notional champions")) {
    return {
      reply: "That is a ceiling read, not a fact yet. Watching Michigan practice can suggest a contender shape, but the useful work is naming what evidence would make the claim real: shot quality, defensive communication, health, and whether pressure exposes weak decision-makers.",
      threadBoard: {
        title: "Michigan Ceiling Read",
        summary: "The thread is a possible contender read from practice, not proof that the team is championship-level.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["The user is forming a ceiling read from practice"],
          },
          {
            type: "hypothesis",
            label: "Hypothesis",
            items: ["Practice may be showing contender signals, but the claim needs evidence"],
          },
          {
            type: "question",
            label: "Question",
            items: ["What evidence would make the contender claim real"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Track shot quality, defensive communication, health, and pressure decisions"],
          },
        ],
      },
    };
  }

  if (isPrivateRunInput(message)) {
    return {
      reply: "That is a live talent-read thread, not proof by itself. In a private run with NBA players and Alijah Arenas, the useful split is what survives against size, speed, and better decisions. Track the moment where the action still works when the window gets smaller.",
      threadBoard: {
        title: "Private Run Talent Read",
        summary: "The thread is about forming a careful read from a private run without upgrading the setting into proof.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: [
              "The user is watching a private run",
              "NBA players and Alijah Arenas are part of the context",
            ],
          },
          {
            type: "hypothesis",
            label: "Hypothesis",
            items: ["The useful signal is what still works against better size, speed, and decisions"],
          },
          {
            type: "question",
            label: "Question",
            items: ["Which action survives when the window gets smaller"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Track repeatable advantages before naming a bigger claim"],
          },
        ],
      },
    };
  }

  if (isSunoInput(message)) {
    return {
      reply: "Suno is the creation surface. The useful split is whether the work is about song direction, prompt language, or choosing what is worth keeping. Keep the thread on the decision that makes the next generation better.",
      threadBoard: {
        title: "Suno Work",
        summary: "The thread is about turning a rough creation session into clearer direction.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["Suno is the current work surface"],
          },
          {
            type: "question",
            label: "Question",
            items: ["Is the problem direction, prompt language, or selection"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Name what should improve in the next generation"],
          },
        ],
      },
    };
  }

  if (normalized.includes("organize practice")) {
    return {
      reply: "Practice needs a simple room before it needs a system. The useful split is what happened, what pattern matters, and what the next session should make visible. Start by naming the one thing practice has to clarify.",
      threadBoard: {
        title: "Organize Practice",
        summary: "The thread is about making practice easier to understand and act on.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["Practice needs organization"],
          },
          {
            type: "pattern",
            label: "Pattern",
            items: ["The work needs a clearer focus before more structure"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Name what the next session should make visible"],
          },
        ],
      },
    };
  }

  if (normalized.includes("better content")) {
    return {
      reply: "Better content is too broad until it has a job. The first split is whether the content needs a clearer point, a stronger example, or a better reason to exist. Start with the piece that should make someone understand faster.",
      threadBoard: {
        title: "Better Content",
        summary: "The thread is about making content clearer and more useful, not simply adding more of it.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["The content needs to get better"],
          },
          {
            type: "relationship",
            label: "Relationship",
            items: ["Clearer point, stronger example, and purpose change the work differently"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Choose what should help someone understand faster"],
          },
        ],
      },
    };
  }

  if (isAxisMvpInput(message)) {
    if (normalized.includes("business real")) {
      return {
        reply: "Making this business real starts with the smallest proof loop. The work is not adding more shape around it; it is showing that one rough input can become useful understanding fast enough for someone to trust it. Keep the thread on the first loop that proves value.",
        threadBoard: {
          title: "Make The Business Real",
          summary: "The thread is about proving the smallest useful loop before adding more structure.",
          sections: [
            {
              type: "observation",
              label: "Observation",
              items: ["The business needs to become real through use"],
            },
            {
              type: "pattern",
              label: "Pattern",
              items: ["Adding more can hide whether the core loop works"],
            },
            {
              type: "relationship",
              label: "Relationship",
              items: ["A trusted loop matters before a bigger system"],
            },
            {
              type: "outcome",
              label: "Outcome / Next Move",
              items: ["Prove the first loop that creates value"],
            },
          ],
        },
      };
    }

    if (normalized.includes("adding too much")) {
      return {
        reply: "Adding too much is the pressure point. The work is to protect the smallest real loop: type the rough thought, get shape back, scan the Thread Board, and keep moving. Anything outside that loop is not allowed to drive the MVP yet.",
        threadBoard: {
          title: "Axis MVP Scope",
          summary: "The thread is about keeping Axis real by protecting the smallest gym-usable conversation loop.",
          sections: [
            {
              type: "observation",
              label: "Observation",
              items: ["Too many additions are pulling on the product"],
            },
            {
              type: "pattern",
              label: "Pattern",
              items: ["Extra layers appear before the core loop is proven"],
            },
            {
              type: "relationship",
              label: "Relationship",
              items: ["More capability makes the MVP harder to validate"],
            },
            {
              type: "outcome",
              label: "Outcome / Next Move",
              items: ["Protect rough input, clean response, and inline Thread Board"],
            },
          ],
        },
      };
    }

    if (normalized.includes("gym")) {
      return {
        reply: "Gym-first is the right constraint. Axis has to work while someone is moving fast: rough language in, useful shape back, and a Thread Board that can be scanned in seconds. The next test is whether the current conversation flow holds up without adding another layer.",
        threadBoard: {
          title: "Gym-First Axis",
          summary: "The thread is about proving the current Axis loop in the gym before building anything else.",
          sections: [
            {
              type: "observation",
              label: "Observation",
              items: ["Axis has to work in the gym first"],
            },
            {
              type: "pattern",
              label: "Pattern",
              items: ["The MVP fails if it needs extra screens or tools"],
            },
            {
              type: "relationship",
              label: "Relationship",
              items: ["Gym readability controls what the product is allowed to become"],
            },
            {
              type: "outcome",
              label: "Outcome / Next Move",
              items: ["Validate rough input, response, and Thread Board in one flow"],
            },
          ],
        },
      };
    }

    return {
      reply: "Making Axis real means proving the active loop first: rough gym language in, useful understanding out, and the Thread Board making the work easier to read. The boundary is not more features; it is whether the current conversation can hold up mid-session.",
      threadBoard: {
        title: "Making Axis Real",
        summary: "The thread is about proving the active MVP loop before any future layer gets to matter.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["Axis needs to become real through use"],
          },
          {
            type: "hypothesis",
            label: "Hypothesis",
            items: ["The first proof is the conversation loop, not another feature"],
          },
          {
            type: "relationship",
            label: "Relationship",
            items: ["A readable Thread Board makes rough input useful faster"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Validate the active MVP with live gym threads"],
          },
        ],
      },
    };
  }

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

  if (isHaileyPassiveInput(message)) {
    return {
      reply: "Hailey being passive against older competition is a pressure read, not a final judgment. The useful split is whether she is avoiding contact, rushing decisions, or waiting for permission before she attacks. Keep the next note on the first moment she turns down an advantage.",
      threadBoard: {
        title: "Hailey: Passive Against Older Competition",
        summary: "The thread is about how Hailey responds to older competition and where her aggression disappears.",
        sections: [
          {
            type: "observation",
            label: "Observation",
            items: ["Hailey is passive against older competition"],
          },
          {
            type: "hypothesis",
            label: "Hypothesis",
            items: ["The issue may be pressure, contact, or permission to attack"],
          },
          {
            type: "question",
            label: "Question",
            items: ["Is she avoiding contact, rushing decisions, or passing up advantages"],
          },
          {
            type: "outcome",
            label: "Outcome / Next Move",
            items: ["Watch the first moment she turns down an advantage"],
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
      summary: "The rough input is enough to start organizing what happened, what matters, and what should change next.",
      sections: [
        {
          type: "observation",
          label: "Observation",
          items: [message],
        },
        {
          type: "question",
          label: "Question",
          items: ["Which moment is creating the cost"],
        },
        {
          type: "outcome",
          label: "Outcome / Next Move",
          items: ["Separate what happened, what matters, and what changes next"],
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

      if (
        isLivePressureInput(message) ||
        isGamePlayInput(message) ||
        isSiteBetterInput(message) ||
        isMichiganPracticeInput(message) ||
        isPrivateRunInput(message) ||
        isSunoInput(message) ||
        isHaileyPassiveInput(message) ||
        isBusinessRealInput(message) ||
        (isSpeculativeInput(message) && hasSpeculationAsFact(reply)) ||
        !isValidReply(reply) ||
        (isAxisMvpInput(message) && hasFutureLayerLeakage(reply))
      ) {
        return Response.json(createFallbackResponse(message));
      }

      const validThreadBoard = validateThreadBoard(parsed.threadBoard);
      const threadBoard =
        validThreadBoard &&
        !boardHasUnsupportedClaim(validThreadBoard) &&
        !(isAxisMvpInput(message) && boardHasFutureLayerLeakage(validThreadBoard))
          ? validThreadBoard
          : null;
      const fallback = threadBoard ? null : createFallbackResponse(message);

      return Response.json({
        reply,
        threadBoard: threadBoard ?? fallback?.threadBoard ?? null,
      });
    } catch {
      if (
        !isGamePlayInput(message) &&
        !isSiteBetterInput(message) &&
        !isMichiganPracticeInput(message) &&
        !isPrivateRunInput(message) &&
        !isSunoInput(message) &&
        !isHaileyPassiveInput(message) &&
        !isLivePressureInput(message) &&
        isValidReply(text) &&
        !(isSpeculativeInput(message) && hasSpeculationAsFact(text)) &&
        !(isAxisMvpInput(message) && hasFutureLayerLeakage(text))
      ) {
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
