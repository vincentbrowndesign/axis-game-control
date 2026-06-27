import OpenAI from "openai";

export const runtime = "nodejs";

type Point = { x: number; y: number };

type BoardMark =
  | { id: string; type: "O"; x: number; y: number }
  | { id: string; type: "X"; x: number; y: number }
  | { id: string; type: "pass"; from: Point; to: Point }
  | { id: string; type: "cut"; from: Point; to: Point }
  | { id: string; type: "draw"; points: Point[] };

type CoachingSection = {
  label: string;
  text: string;
};

const SECTION_LABELS = [
  "What I see",
  "Where the advantage is",
  "What can break it",
  "Best solution",
  "Rep to test",
  "Teaching cue",
] as const;

function fallback(note: string, marks: BoardMark[]): CoachingSection[] {
  const counts = countMarks(marks);
  const hasPass = counts.pass > 0;
  const hasCut = counts.cut > 0;
  const hasDraw = counts.draw > 0;
  const hasDefense = counts.X > 0;
  const lower = note.toLowerCase();

  const action = hasPass && hasCut
    ? "a pass-and-cut action"
    : hasCut
      ? "a cutting action"
      : hasPass
        ? "a passing action"
        : hasDraw
          ? "a drawn movement path"
          : "a spacing setup";

  const pressure = hasDefense
    ? `${counts.X} defender${counts.X === 1 ? "" : "s"} can shrink the first action if the spacing is late`
    : "without defenders drawn, the main risk is timing rather than coverage";

  const advantage = hasCut
    ? "The advantage is the cutter moving before the defense can see both ball and man."
    : hasPass
      ? "The advantage is created by moving the ball before the defense can load to one side."
      : "The advantage has to come from spacing first, then a decisive first action.";

  const solution = lower.includes("zone")
    ? "Put one O in the gap, use the pass to move the zone, then cut behind the second defender as the ball arrives."
    : hasPass && hasCut
      ? "Make the pass first, cut immediately off the passer's shoulder, and keep the weak-side O spaced so help has to choose."
      : hasCut
        ? "Start the cut after the defender turns their head, not before. The passer should hold the ball until the cutter crosses the defender's face."
        : hasPass
          ? "Use the pass to shift the defense, then add a second action right away so the catch is not a dead end."
          : "Add one clear first trigger: screen, cut, or pass. The board needs a defined advantage before the shot or drive.";

  return [
    {
      label: "What I see",
      text: `The board shows ${counts.O} offensive O${counts.O === 1 ? "" : "s"}, ${counts.X} defensive X${counts.X === 1 ? "" : "s"}, and ${action}.`,
    },
    {
      label: "Where the advantage is",
      text: advantage,
    },
    {
      label: "What can break it",
      text: pressure,
    },
    {
      label: "Best solution",
      text: solution,
    },
    {
      label: "Rep to test",
      text: `Run it ${Math.max(2, counts.O)}-on-${Math.max(1, counts.X || 1)} from the drawn spots. Score the rep only when the first read creates an open catch or lane.`,
    },
    {
      label: "Teaching cue",
      text: hasCut ? "Pass, cut, hold spacing." : "Create the first advantage.",
    },
  ];
}

async function visionAnalysis(note: string, imageData: string, marks: BoardMark[]): Promise<CoachingSection[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const boardSummary = summarizeMarks(marks);

  const prompt = `You are Axis Board, a basketball whiteboard analyst for coaches.

Use BOTH sources:
- Screenshot: what the drawn court looks like.
- boardMarks: exact structured O/X/pass/cut/draw marks.

Coach question: ${note}

boardMarks:
${JSON.stringify(boardSummary, null, 2)}

Return ONLY valid JSON:
{
  "sections": [
    { "label": "What I see", "text": "specific to the drawn marks" },
    { "label": "Where the advantage is", "text": "specific to spacing/action" },
    { "label": "What can break it", "text": "specific defensive failure point" },
    { "label": "Best solution", "text": "specific adjustment" },
    { "label": "Rep to test", "text": "specific practice rep" },
    { "label": "Teaching cue", "text": "short floor cue" }
  ]
}

Rules:
- Do not give generic coaching language.
- Refer to O players, X defenders, pass arrows, cut arrows, and spacing when useful.
- Do not invent player identities, shot results, stats, score, or certainty.
- Keep each text field one or two concrete sentences.`;

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      temperature: 0.25,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageData, detail: "low" } },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as { sections?: unknown[] };
    if (!Array.isArray(parsed.sections)) return null;

    const sections = parsed.sections
      .filter((section): section is CoachingSection => {
        const record = section as Record<string, unknown>;
        return typeof record.label === "string" && typeof record.text === "string";
      })
      .map((section) => ({ label: section.label, text: section.text }));

    return normalizeSections(sections);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    boardMarks?: unknown;
    imageData?: string;
    note?: string;
    query?: string;
  } | null;

  if (!body) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const rawQuery = typeof body.query === "string"
    ? body.query
    : typeof body.note === "string"
      ? body.note
      : "";

  if (!rawQuery.trim()) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const note = rawQuery.trim().slice(0, 1000);
  const imageData = typeof body.imageData === "string" ? body.imageData : null;
  const marks = parseBoardMarks(body.boardMarks).slice(0, 200);

  const sections = imageData
    ? (await visionAnalysis(note, imageData, marks)) ?? fallback(note, marks)
    : fallback(note, marks);

  return Response.json({ sections: normalizeSections(sections) });
}

function normalizeSections(sections: CoachingSection[]) {
  return SECTION_LABELS.map((label) => ({
    label,
    text: sections.find((section) => section.label.toLowerCase() === label.toLowerCase())?.text
      ?? fallback("", [])[SECTION_LABELS.indexOf(label)]?.text
      ?? "",
  }));
}

function parseBoardMarks(value: unknown): BoardMark[] {
  if (!Array.isArray(value)) return [];
  const marks: BoardMark[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : crypto.randomUUID();
    const type = record.type;

    if ((type === "O" || type === "X") && isFiniteNumber(record.x) && isFiniteNumber(record.y)) {
      marks.push({ id, type, x: clamp01(record.x), y: clamp01(record.y) });
    }

    if ((type === "pass" || type === "cut") && isPoint(record.from) && isPoint(record.to)) {
      marks.push({ id, type, from: normalizePoint(record.from), to: normalizePoint(record.to) });
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
