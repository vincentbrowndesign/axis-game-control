import OpenAI from "openai";

export const runtime = "nodejs";

type BoardObjSummary = {
  type: string;
  ptCount: number;
  text?: string;
};

type AxisReadout = {
  concept: string;
  pattern: string;
  problem: string;
  solution: string;
  rep: string;
  teachingCue: string;
  tags: string[];
};

// ─── Fallback: deterministic readout from note + board objects ────────────────

function fallbackReadout(note: string, objects: BoardObjSummary[]): AxisReadout {
  const lower = note.toLowerCase();
  const types = objects.map((o) => o.type);

  const counts = {
    player: types.filter((t) => t === "player").length,
    defender: types.filter((t) => t === "defender").length,
    pass: types.filter((t) => t === "pass").length,
    cut: types.filter((t) => t === "cut").length,
    screen: types.filter((t) => t === "screen").length,
    zone: types.filter((t) => t === "zone").length,
    dribble: types.filter((t) => t === "dribble").length,
  };

  // Pick and roll
  if (counts.screen >= 1 && (counts.pass >= 1 || counts.cut >= 1 || lower.includes("pick") || lower.includes("screen") || lower.includes("roll"))) {
    return {
      concept: "Pick and Roll",
      pattern: "Two-man game — ball-handler and screener",
      problem: lower.includes("hedge") || lower.includes("under") ? "Defense going under the screen" : "Reading the coverage and making the right decision",
      solution: "Read the defender: roll if they follow the screener, pop if they hedge",
      rep: "2-on-0 set reps, then 2-on-2 live read",
      teachingCue: "Set hard. Seal. Read the gap.",
      tags: ["pick and roll", "ball screen", "two-man game"],
    };
  }

  // Transition / fast break
  if (lower.includes("fast break") || lower.includes("transition") || lower.includes("outlet")) {
    return {
      concept: "Transition Offense",
      pattern: "Push the pace — numbers advantage before defense sets",
      problem: "Defense recovering to take away the numbers advantage",
      solution: "Fill lanes early, attack before the defense has two feet set",
      rep: "3-on-2 drill from the baseline",
      teachingCue: "Sprint, fill, attack.",
      tags: ["transition", "fast break", "push pace"],
    };
  }

  // Zone offense
  if (counts.zone >= 1 || lower.includes("zone") || lower.includes("2-3") || lower.includes("match")) {
    return {
      concept: "Zone Attack",
      pattern: "Ball movement to collapse the gaps",
      problem: "Zone denying inside passes and controlling the paint",
      solution: "Use the short corner, skip passes, and attack the gaps in rotation",
      rep: "5-on-5 walk-through, then 5-on-5 live against zone",
      teachingCue: "Find the gap. Skip. Seal the cutter.",
      tags: ["zone offense", "ball movement", "skip pass"],
    };
  }

  // Motion / cutting
  if (counts.cut >= 2 || lower.includes("motion") || lower.includes("cut") || lower.includes("backdoor")) {
    return {
      concept: "Motion Offense",
      pattern: "Read-and-react cutting from the perimeter",
      problem: "Defenders overplaying and denying the pass",
      solution: "Backdoor cut when defender is in denial, or replace and relocate",
      rep: "Pass and cut 3-man weave, then 5-on-0 motion flow",
      teachingCue: "See your defender. Cut when they turn.",
      tags: ["motion", "cutting", "read and react"],
    };
  }

  // Post play
  if (lower.includes("post") || lower.includes("block") || lower.includes("low post")) {
    return {
      concept: "Post Play",
      pattern: "Entry and isolation in the low post",
      problem: "Defender fronting or playing behind the post",
      solution: "Seal and call for the lob on a front, use drop step on back defense",
      rep: "1-on-1 post reps from the right and left block",
      teachingCue: "Feel the defender. Attack the open hip.",
      tags: ["post", "low block", "entry pass"],
    };
  }

  // Inbound play
  if (lower.includes("inbound") || lower.includes("baseline") || lower.includes("out of bounds")) {
    return {
      concept: "Baseline Out of Bounds",
      pattern: "Set play with staggered screens",
      problem: "Defense knowing the play and switching everything",
      solution: "Change timing or attack the switch with a mismatch",
      rep: "Walk-through at full speed, then execute with live defense",
      teachingCue: "First option. Second option. Inbounder safety valve.",
      tags: ["BLOB", "inbound play", "set play"],
    };
  }

  // Default (general play design)
  const playerCount = counts.player;
  const hasAction = counts.pass > 0 || counts.cut > 0 || counts.dribble > 0;

  return {
    concept: hasAction ? "Designed Action" : "Spacing Set",
    pattern: playerCount >= 4
      ? "Team movement with multiple action options"
      : playerCount >= 2
        ? "Two-man action building from positioning"
        : "Initial positioning and spacing",
    problem: lower.trim() || "Creating a quality look from the designed action",
    solution: "Execute the first action, read the defense, hit the open man",
    rep: "Walk-through at game speed, then execute live 5-on-0",
    teachingCue: "Read. React. Execute.",
    tags: ["play design", "action", "offense"],
  };
}

// ─── OpenAI response ──────────────────────────────────────────────────────────

async function openaiReadout(note: string, objects: BoardObjSummary[]): Promise<AxisReadout | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const objectSummary = objects.length > 0
    ? objects.map((o) => `${o.type}${o.text ? ` (${o.text})` : ""}`).join(", ")
    : "no objects drawn";

  const prompt = `You are an elite basketball coach and play designer. Analyze this basketball board setup and return a structured coaching readout.

Board setup:
- Coach's note: "${note}"
- Board objects: ${objectSummary}

Return ONLY valid JSON in this exact format, no other text:
{
  "concept": "Short name for the play or concept (2-4 words)",
  "pattern": "One sentence describing the movement pattern",
  "problem": "The specific defensive problem this solves (one sentence)",
  "solution": "Specific technical solution (one sentence)",
  "rep": "Drill or rep structure to practice this (one sentence)",
  "teachingCue": "A short, memorable verbal cue (4-8 words)",
  "tags": ["tag1", "tag2", "tag3"]
}

Use simple language. No jargon for its own sake. Be specific. Tags should be 2-4 lowercase terms.`;

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      temperature: 0.4,
      messages: [
        { role: "user", content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      concept: String(parsed.concept ?? ""),
      pattern: String(parsed.pattern ?? ""),
      problem: String(parsed.problem ?? ""),
      solution: String(parsed.solution ?? ""),
      rep: String(parsed.rep ?? ""),
      teachingCue: String(parsed.teachingCue ?? ""),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  } catch {
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { note?: string; objects?: BoardObjSummary[] } | null;
  if (!body || typeof body.note !== "string" || !body.note.trim()) {
    return Response.json({ error: "note is required" }, { status: 400 });
  }

  const note = body.note.trim().slice(0, 1000);
  const objects: BoardObjSummary[] = Array.isArray(body.objects) ? body.objects.slice(0, 100) : [];

  const readout = (await openaiReadout(note, objects)) ?? fallbackReadout(note, objects);

  return Response.json({ readout });
}
