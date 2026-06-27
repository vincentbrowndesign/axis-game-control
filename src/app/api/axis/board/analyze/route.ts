import OpenAI from "openai";

export const runtime = "nodejs";

type Point = { x: number; y: number };

type BoardMark =
  | { id: string; type: "O"; label: string; x: number; y: number }
  | { id: string; type: "X"; label: string; x: number; y: number }
  | { id: string; type: "pass"; from: Point; to: Point; label?: string }
  | { id: string; type: "cut"; from: Point; to: Point; label?: string }
  | { id: string; type: "draw"; points: Point[] };

type AxisBoardIntent = "reason" | "populate" | "adjust";
type SectionLabel = "CALL" | "READ" | "COUNTER" | "CUE" | "WHY" | "TEACH" | "REP" | "WALKTHROUGH";

type AxisBoardSection = {
  label: SectionLabel;
  text: string;
};

type AxisBoardResponse = {
  intent: AxisBoardIntent;
  boardMarks?: BoardMark[];
  sections: AxisBoardSection[];
};

const DEFAULT_LABELS: SectionLabel[] = ["CALL", "READ", "COUNTER", "CUE"];
const DEEP_LABELS: SectionLabel[] = ["WHY", "TEACH", "REP", "WALKTHROUGH"];
const ALL_LABELS = [...DEFAULT_LABELS, ...DEEP_LABELS];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    boardMarks?: unknown;
    imageData?: string;
    note?: string;
    query?: string;
  } | null;

  if (!body) return Response.json({ error: "query is required" }, { status: 400 });

  const rawQuery = typeof body.query === "string"
    ? body.query
    : typeof body.note === "string"
      ? body.note
      : "";

  if (!rawQuery.trim()) return Response.json({ error: "query is required" }, { status: 400 });

  const query = rawQuery.trim().slice(0, 1000);
  const imageData = typeof body.imageData === "string" ? body.imageData : null;
  const marks = parseBoardMarks(body.boardMarks).slice(0, 200);
  const intent = inferIntent(query, marks);
  const deepLabels = requestedDeepLabels(query);

  const ai = imageData
    ? await visionAnalysis({ query, imageData, marks, intent, deepLabels })
    : null;

  return Response.json(normalizeResponse(ai ?? fallback({ query, marks, intent, deepLabels }), deepLabels));
}

async function visionAnalysis(args: {
  query: string;
  imageData: string;
  marks: BoardMark[];
  intent: AxisBoardIntent;
  deepLabels: SectionLabel[];
}): Promise<AxisBoardResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are Axis Board, a basketball coach in a timeout.

Use BOTH sources:
- Screenshot: the whiteboard image.
- boardMarks: structured normalized marks, where x=0 left sideline, x=1 right sideline, y=0 baseline/rim side, y=1 half-court/top side.

Coach question: ${args.query}
Requested intent: ${args.intent}
Extra sections requested: ${args.deepLabels.length ? args.deepLabels.join(", ") : "none"}

boardMarks:
${JSON.stringify(summarizeMarks(args.marks), null, 2)}

Return ONLY valid JSON matching:
{
  "intent": "reason" | "populate" | "adjust",
  "boardMarks": [
    { "id": "o1", "type": "O", "label": "1", "x": 0.5, "y": 0.75 },
    { "id": "x1", "type": "X", "label": "X1", "x": 0.5, "y": 0.62 },
    { "id": "p1", "type": "pass", "from": { "x": 0.2, "y": 0.3 }, "to": { "x": 0.5, "y": 0.55 }, "label": "hit" },
    { "id": "c1", "type": "cut", "from": { "x": 0.8, "y": 0.25 }, "to": { "x": 0.5, "y": 0.12 }, "label": "cut" }
  ],
  "sections": [
    { "label": "CALL", "text": "one short action name or command" },
    { "label": "READ", "text": "first decision" },
    { "label": "COUNTER", "text": "what to do if defense takes it away" },
    { "label": "CUE", "text": "short phrase a coach can say now" }
  ]
}

Rules:
- Sound like a coach in a timeout, not a basketball article.
- Default sections are ONLY CALL, READ, COUNTER, CUE unless extra sections are requested above.
- If extra sections are requested, add only those exact labels.
- Keep each default text under 12 words.
- Be specific to O/X/pass/cut spacing. No generic lines.
- No player identities, shot results, stats, score, or certainty.
- If intent is populate, return a simple actionable setup in boardMarks.
- If intent is adjust, return adjusted boardMarks only when the query clearly asks to change the board.
- If intent is reason, omit boardMarks.`;

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 650,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: args.imageData, detail: "low" } },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return parseAxisBoardResponse(JSON.parse(match[0]), args.intent);
  } catch {
    return null;
  }
}

function fallback(args: {
  query: string;
  marks: BoardMark[];
  intent: AxisBoardIntent;
  deepLabels: SectionLabel[];
}): AxisBoardResponse {
  const workingMarks = args.intent === "populate"
    ? buildSetupFromQuery(args.query)
    : args.intent === "adjust"
      ? adjustSetupFromQuery(args.query, args.marks)
      : args.marks;
  const counts = countMarks(workingMarks);
  const lower = args.query.toLowerCase();
  const hasTrap = lower.includes("trap") || lower.includes("press");
  const hasZone = lower.includes("zone");
  const hasPass = counts.pass > 0;
  const hasCut = counts.cut > 0;

  const call = hasTrap
    ? "Middle flash."
    : hasZone
      ? "Gap touch."
      : hasPass && hasCut
        ? "Pass and cut."
        : hasCut
          ? "Back cut."
          : hasPass
            ? "Swing it."
            : "Create a trigger.";

  const read = hasTrap
    ? "Hit middle before the second X arrives."
    : hasZone
      ? "Touch the gap, then look corner."
      : hasCut
        ? "Cutter goes when X turns head."
        : hasPass
          ? "Move it before help loads."
          : "Choose pass, cut, or screen first.";

  const counter = hasTrap
    ? "Trap stays: slot follows. Help leaves: corner lifts."
    : hasZone
      ? "Middle closes: skip behind the zone."
      : hasCut
        ? "X sits low: pop back to space."
        : hasPass
          ? "Overplay: back cut the receiver."
          : "No advantage: clear and restart.";

  const sections: AxisBoardSection[] = [
    { label: "CALL", text: call },
    { label: "READ", text: read },
    { label: "COUNTER", text: counter },
    { label: "CUE", text: hasTrap ? "Touch middle, beat the trap." : hasCut ? "Cut when eyes turn." : "Make help choose." },
  ];

  if (args.deepLabels.includes("WHY")) {
    sections.push({ label: "WHY", text: "The first pass moves the nearest X; the cut punishes help." });
  }
  if (args.deepLabels.includes("TEACH")) {
    sections.push({ label: "TEACH", text: "Freeze on the catch. Point to the open help decision." });
  }
  if (args.deepLabels.includes("REP")) {
    sections.push({ label: "REP", text: `${Math.max(3, counts.O)}-on-${Math.max(2, counts.X || 2)}. Score only clean first reads.` });
  }
  if (args.deepLabels.includes("WALKTHROUGH")) {
    sections.push({ label: "WALKTHROUGH", text: "Flash middle, pass out, cut behind the X, then lift corner." });
  }

  return {
    intent: args.intent,
    boardMarks: args.intent === "reason" ? undefined : workingMarks,
    sections,
  };
}

function buildSetupFromQuery(query: string): BoardMark[] {
  const lower = query.toLowerCase();
  if (lower.includes("corner") && lower.includes("trap")) {
    return [
      { id: "o1", type: "O", label: "1", x: 0.84, y: 0.22 },
      { id: "o2", type: "O", label: "2", x: 0.66, y: 0.44 },
      { id: "o3", type: "O", label: "3", x: 0.50, y: 0.58 },
      { id: "o4", type: "O", label: "4", x: 0.24, y: 0.30 },
      { id: "x1", type: "X", label: "X1", x: 0.76, y: 0.22 },
      { id: "x2", type: "X", label: "X2", x: 0.86, y: 0.34 },
      { id: "x3", type: "X", label: "X3", x: 0.58, y: 0.47 },
      { id: "p1", type: "pass", from: { x: 0.84, y: 0.22 }, to: { x: 0.50, y: 0.58 }, label: "middle" },
      { id: "c1", type: "cut", from: { x: 0.66, y: 0.44 }, to: { x: 0.90, y: 0.14 }, label: "behind" },
    ];
  }

  return [
    { id: "o1", type: "O", label: "1", x: 0.50, y: 0.76 },
    { id: "o2", type: "O", label: "2", x: 0.22, y: 0.48 },
    { id: "o3", type: "O", label: "3", x: 0.78, y: 0.48 },
    { id: "o4", type: "O", label: "4", x: 0.38, y: 0.24 },
    { id: "x1", type: "X", label: "X1", x: 0.50, y: 0.62 },
    { id: "x2", type: "X", label: "X2", x: 0.28, y: 0.42 },
    { id: "x3", type: "X", label: "X3", x: 0.70, y: 0.42 },
    { id: "p1", type: "pass", from: { x: 0.50, y: 0.76 }, to: { x: 0.38, y: 0.24 }, label: "flash" },
    { id: "c1", type: "cut", from: { x: 0.78, y: 0.48 }, to: { x: 0.58, y: 0.13 }, label: "cut" },
  ];
}

function adjustSetupFromQuery(query: string, marks: BoardMark[]): BoardMark[] {
  if (marks.length === 0) return buildSetupFromQuery(query);
  const lower = query.toLowerCase();
  if (!lower.includes("space") && !lower.includes("corner") && !lower.includes("trap") && !lower.includes("adjust")) {
    return marks;
  }

  return marks.map((mark) => {
    if (mark.type === "O" && mark.x > 0.5) return { ...mark, x: clamp01(mark.x + 0.06) };
    if (mark.type === "O" && mark.x < 0.5) return { ...mark, x: clamp01(mark.x - 0.06) };
    return mark;
  });
}

function inferIntent(query: string, marks: BoardMark[]): AxisBoardIntent {
  const lower = query.toLowerCase();
  const populateWords = ["build", "show", "set up", "setup", "draw", "create", "design"];
  const adjustWords = ["fix", "adjust", "change", "shift", "move", "replace", "counter this"];
  if (marks.length === 0 && populateWords.some((word) => lower.includes(word))) return "populate";
  if (marks.length > 0 && adjustWords.some((word) => lower.includes(word))) return "adjust";
  return "reason";
}

function requestedDeepLabels(query: string): SectionLabel[] {
  const lower = query.toLowerCase();
  const labels: SectionLabel[] = [];
  if (lower.includes("why") || lower.includes("go deeper") || lower.includes("explain")) labels.push("WHY");
  if (lower.includes("teach")) labels.push("TEACH");
  if (lower.includes("rep") || lower.includes("practice")) labels.push("REP");
  if (lower.includes("walkthrough") || lower.includes("walk through")) labels.push("WALKTHROUGH");
  return labels;
}

function normalizeResponse(response: AxisBoardResponse, deepLabels: SectionLabel[]): AxisBoardResponse {
  const labels = [...DEFAULT_LABELS, ...deepLabels];
  const sections = response.sections
    .filter((section) => labels.includes(section.label))
    .map((section) => ({
      label: section.label,
      text: section.text.trim().slice(0, section.label === "CUE" ? 80 : 140),
    }));

  const filled = DEFAULT_LABELS.map((label) => (
    sections.find((section) => section.label === label)
    ?? fallback({ query: "", marks: response.boardMarks ?? [], intent: "reason", deepLabels: [] }).sections.find((section) => section.label === label)!
  ));

  const extra = sections.filter((section) => deepLabels.includes(section.label));

  return {
    intent: response.intent,
    boardMarks: response.boardMarks ? parseBoardMarks(response.boardMarks) : undefined,
    sections: [...filled, ...extra],
  };
}

function parseAxisBoardResponse(value: unknown, fallbackIntent: AxisBoardIntent): AxisBoardResponse | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const intent = record.intent === "populate" || record.intent === "adjust" || record.intent === "reason"
    ? record.intent
    : fallbackIntent;
  const sections = Array.isArray(record.sections)
    ? record.sections.flatMap((section): AxisBoardSection[] => {
      if (!section || typeof section !== "object") return [];
      const item = section as Record<string, unknown>;
      if (!isSectionLabel(item.label) || typeof item.text !== "string") return [];
      return [{ label: item.label, text: item.text }];
    })
    : [];

  if (sections.length === 0) return null;
  return {
    intent,
    boardMarks: parseBoardMarks(record.boardMarks),
    sections,
  };
}

function parseBoardMarks(value: unknown): BoardMark[] {
  if (!Array.isArray(value)) return [];
  const marks: BoardMark[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
    const type = record.type;

    if ((type === "O" || type === "X") && isFiniteNumber(record.x) && isFiniteNumber(record.y)) {
      marks.push({
        id,
        type,
        label: typeof record.label === "string" && record.label.trim()
          ? record.label.trim().slice(0, 3)
          : defaultPlayerLabel(type, marks),
        x: clamp01(record.x),
        y: clamp01(record.y),
      });
    }

    if ((type === "pass" || type === "cut") && isPoint(record.from) && isPoint(record.to)) {
      const mark: Extract<BoardMark, { type: "pass" | "cut" }> = {
        id,
        type,
        from: normalizePoint(record.from),
        to: normalizePoint(record.to),
      };
      if (typeof record.label === "string" && record.label.trim()) mark.label = record.label.trim().slice(0, 12);
      marks.push(mark);
    }

    if (type === "draw" && Array.isArray(record.points)) {
      const points = record.points.filter(isPoint).map(normalizePoint).slice(0, 500);
      if (points.length > 1) marks.push({ id, type, points });
    }
  }

  return marks;
}

function summarizeMarks(marks: BoardMark[]) {
  return marks.map((mark) => {
    if (mark.type === "draw") return { type: mark.type, pointCount: mark.points.length };
    return mark;
  });
}

function countMarks(marks: BoardMark[]) {
  return marks.reduce<Record<"O" | "X" | "pass" | "cut" | "draw", number>>((acc, mark) => {
    acc[mark.type] += 1;
    return acc;
  }, { O: 0, X: 0, pass: 0, cut: 0, draw: 0 });
}

function defaultPlayerLabel(type: "O" | "X", marks: BoardMark[]) {
  const count = marks.filter((mark) => mark.type === type).length + 1;
  return type === "O" ? String(count) : `X${count}`;
}

function isSectionLabel(value: unknown): value is SectionLabel {
  return typeof value === "string" && ALL_LABELS.includes(value as SectionLabel);
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.x) && isFiniteNumber(record.y);
}

function normalizePoint(point: Point) {
  return { x: clamp01(point.x), y: clamp01(point.y) };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
