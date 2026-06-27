import OpenAI from "openai";

export const runtime = "nodejs";

type CoachingSection = {
  label: string;
  text: string;
};

// ─── Fallback: deterministic coaching from note keywords ──────────────────────

function fallback(note: string): CoachingSection[] {
  const q = note.toLowerCase();

  if (q.includes("pick") || q.includes("screen") || q.includes("roll") || q.includes("ball screen")) {
    return [
      { label: "What I see", text: "A ball screen action with the handler reading coverage." },
      { label: "The pattern", text: "Pick and roll — two-man game between the handler and screener." },
      { label: "The problem", text: "Defense using a hedge or switch to take away the roll." },
      { label: "The solution", text: "Read the coverage early. Pop if they hedge, roll hard if they follow, attack the switch if they swap." },
      { label: "Rep", text: "2-on-2 from the top. Handler and screener vs two defenders. Make a read, execute, evaluate." },
      { label: "Teaching cue", text: "\"Set hard. Seal. Read the gap.\"" },
    ];
  }

  if (q.includes("zone") || q.includes("2-3") || q.includes("match-up")) {
    return [
      { label: "What I see", text: "An offense trying to break down a zone defense." },
      { label: "The pattern", text: "Zone attack — ball movement to collapse gaps and create open looks." },
      { label: "The problem", text: "Zone rotating in time to close every gap and control the paint." },
      { label: "The solution", text: "Use the short corner, skip passes, and move the ball before the zone can rotate." },
      { label: "Rep", text: "5-on-0 zone walkthrough at full speed. Then 5-on-5 live against zone." },
      { label: "Teaching cue", text: "\"Find the gap. Skip. Seal the cutter.\"" },
    ];
  }

  if (q.includes("transition") || q.includes("fast break") || q.includes("outlet")) {
    return [
      { label: "What I see", text: "A push-pace or transition action." },
      { label: "The pattern", text: "Early offense — attacking before the defense can set." },
      { label: "The problem", text: "Defense sprinting back and removing the numbers advantage." },
      { label: "The solution", text: "Fill the lanes early. Attack before they have two feet set. If the numbers are gone, get into half-court offense." },
      { label: "Rep", text: "3-on-2 from the baseline. Sprint, fill, attack." },
      { label: "Teaching cue", text: "\"Sprint, fill, attack.\"" },
    ];
  }

  if (q.includes("post") || q.includes("block") || q.includes("low post")) {
    return [
      { label: "What I see", text: "Post entry and low-block isolation." },
      { label: "The pattern", text: "Post play — reading the defender's position to choose the right move." },
      { label: "The problem", text: "Defender fronting or playing behind, making the entry difficult." },
      { label: "The solution", text: "On a front, seal and call for the lob. On back defense, use the drop step to the open side. Read before you catch." },
      { label: "Rep", text: "1-on-1 post reps from both the right and left block." },
      { label: "Teaching cue", text: "\"Feel the defender. Attack the open hip.\"" },
    ];
  }

  if (q.includes("inbound") || q.includes("out of bounds") || q.includes("blob") || q.includes("slob")) {
    return [
      { label: "What I see", text: "A designed out-of-bounds play." },
      { label: "The pattern", text: "Set play with staggered or sequential screens to free a shooter." },
      { label: "The problem", text: "Defense knowing the play and switching or doubling every action." },
      { label: "The solution", text: "Change the timing or attack the switch with a mismatch. Have a safety valve option built in." },
      { label: "Rep", text: "Walk through at full speed, then execute live with your defense." },
      { label: "Teaching cue", text: "\"First look. Second look. Safety valve.\"" },
    ];
  }

  // Generic
  return [
    { label: "What I see", text: "A play or action being designed against a set defense." },
    { label: "The pattern", text: "The setup suggests a half-court offensive action with spacing as the foundation." },
    { label: "The problem", text: note.trim() || "Creating a quality look against organized defense." },
    { label: "The solution", text: "Execute the first action at game speed, read the defense, and hit the open man." },
    { label: "Rep", text: "Walk through 5-on-0 at game speed. Then run it live against your second unit." },
    { label: "Teaching cue", text: "\"Read. React. Execute.\"" },
  ];
}

// ─── OpenAI vision analysis ───────────────────────────────────────────────────

async function visionAnalysis(note: string, imageData: string): Promise<CoachingSection[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are an elite basketball coach reviewing a whiteboard play drawn by another coach. The drawing shows a basketball half-court with players, defenders, and movement markings. Analyze what you see and give practical, specific coaching advice.

Return ONLY valid JSON — no markdown, no prose, no explanation outside the JSON:

{
  "sections": [
    { "label": "What I see", "text": "One sentence describing what is drawn on the board." },
    { "label": "The pattern", "text": "One sentence naming the play concept or movement." },
    { "label": "The problem", "text": "One sentence on the defensive problem this addresses or the challenge the coach is facing." },
    { "label": "The solution", "text": "One to two sentences with a specific, practical solution." },
    { "label": "Rep", "text": "One sentence describing a drill or rep to practice this." },
    { "label": "Teaching cue", "text": "A short, memorable phrase a coach says on the floor. 4-8 words." }
  ]
}

Rules: Be specific to what is actually drawn. Use simple coach language. Keep each section 1-2 sentences. If the drawing is hard to read, describe what you can see and give the best advice based on the question.`;

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageData, detail: "low" },
            },
            {
              type: "text",
              text: `${systemPrompt}\n\nCoach's question: "${note}"`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as { sections?: unknown[] };
    if (!Array.isArray(parsed.sections)) return null;

    return parsed.sections
      .filter((s): s is { label: string; text: string } =>
        typeof (s as Record<string, unknown>).label === "string" &&
        typeof (s as Record<string, unknown>).text === "string"
      )
      .map((s) => ({ label: s.label, text: s.text }));
  } catch {
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    note?: string;
    imageData?: string;
  } | null;

  if (!body || typeof body.note !== "string" || !body.note.trim()) {
    return Response.json({ error: "note is required" }, { status: 400 });
  }

  const note = body.note.trim().slice(0, 1000);
  const imageData = typeof body.imageData === "string" ? body.imageData : null;

  const sections = imageData
    ? (await visionAnalysis(note, imageData)) ?? fallback(note)
    : fallback(note);

  return Response.json({ sections });
}
