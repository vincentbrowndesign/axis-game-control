import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/* ============================================================
   AXIS open-command resolver — no dead ends.

   Everything typed into the instrument's command line resolves
   to one of two shapes:
     { kind: "command", intent, arg }        — dispatched client-side
     { kind: "answer", headline, sub }       — broadcast lower-third

   Decision order: command → session answer (grounded strictly in
   provided state) → knowledge answer (typical ranges, never
   phrased as measured) → off-domain one-liner steering back.
============================================================ */

const TESTS = ["JUMP", "CMJ", "DROP JUMP", "LANDING", "LATERAL", "SPRINT", "DECEL", "SHOOTING"];
const INTENTS = ["test", "athlete", "record", "capture", "save"] as const;

type ResolverIntent = (typeof INTENTS)[number];

type ResolverState = {
  test: string | null;
  athlete: string | null;
  recording: boolean;
  reps: number;
  queued: number;
  poseFresh: boolean;
  angles: Record<string, number>;
};

type ResolverResult =
  | { kind: "command"; intent: ResolverIntent; arg: string | null }
  | { kind: "answer"; headline: string; sub: string | null };

const RESULT_SCHEMA = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "intent", "arg"],
      properties: {
        kind: { const: "command" },
        intent: { type: "string", enum: [...INTENTS] },
        arg: { type: ["string", "null"] },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "headline", "sub"],
      properties: {
        kind: { const: "answer" },
        headline: { type: "string" },
        sub: { type: ["string", "null"] },
      },
    },
  ],
};

const SYSTEM_PROMPT = `You are the Axis resolver — the open command line of a courtside sports-biomechanics camera instrument. A coach types anything mid-session; you return exactly one JSON object. Work through this decision order and take the first match:

1. COMMAND — the text loosely maps to an instrument action. Return {"kind":"command","intent":...,"arg":...}. Intents:
   - "test": arm a movement test. arg must be one of: ${TESTS.join(", ")}. ("let's do landings" → LANDING, "depth jumps" → DROP JUMP)
   - "athlete": select an athlete. arg is the number or name. ("lock in number 4" → "4")
   - "record": toggle rep recording. ("run it back", "go", "stop", "again")
   - "capture": grab a still frame. ("snap that", "freeze it")
   - "save": export queued evidence to the camera roll. ("send it", "export")
   Use arg null when the intent takes no argument.

2. SESSION ANSWER — the text asks about the current session. Ground the answer STRICTLY in the provided session state. Never claim a measurement the state does not contain. angles are live joint angles in degrees (only quote them when poseFresh is true — false means the camera has no current lock); reps is completed recorded reps; queued is unsaved evidence files. If the state lacks what is asked (no reps, no live angles), the headline says so plainly (e.g. "NO REPS YET") and the sub says how to get one.

3. KNOWLEDGE ANSWER — a general sports-biomechanics or training question. Answer with typical published ranges, phrased as typical values for athletes in general — NEVER phrased as if measured on this athlete. (e.g. headline "KNEE FLEXION 60–90° AT CONTACT", sub "Deeper flexion absorbs force; stiff landings load the ACL.")

4. ANYTHING ELSE — off-domain still gets a brief good-natured one-liner headline, with a sub steering back to the session.

Answers are broadcast graphics, not chat: {"kind":"answer","headline":...,"sub":...}.
- headline: 60 characters max, UPPERCASE, stat-first where possible (e.g. "L KNEE 71° · R KNEE 68° · 2 REPS").
- sub: one plain sentence, 110 characters max, sentence case. Use null only when nothing useful fits.

Honesty guards (non-negotiable):
- Session stats come only from the provided state — a measurement not present in the state does not exist.
- Knowledge answers speak in typical ranges; they are never this athlete's numbers.`;

/* per-IP sliding window — first guard; serverless instances each keep their own */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function clampResult(raw: unknown): ResolverResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "command" && INTENTS.includes(r.intent as ResolverIntent)) {
    return {
      kind: "command",
      intent: r.intent as ResolverIntent,
      arg: typeof r.arg === "string" && r.arg.length > 0 ? r.arg.slice(0, 60) : null,
    };
  }
  if (r.kind === "answer" && typeof r.headline === "string" && r.headline.length > 0) {
    return {
      kind: "answer",
      headline: r.headline.slice(0, 60).toUpperCase(),
      sub: typeof r.sub === "string" && r.sub.length > 0 ? r.sub.slice(0, 110) : null,
    };
  }
  return null;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Resolver not configured." }, { status: 503 });
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  let text = "";
  let state: Partial<ResolverState> = {};
  try {
    const body = (await request.json()) as { text?: unknown; state?: Partial<ResolverState> };
    text = typeof body.text === "string" ? body.text.trim() : "";
    state = body.state && typeof body.state === "object" ? body.state : {};
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!text || text.length > 300) {
    return NextResponse.json({ error: "Invalid text." }, { status: 400 });
  }

  const sessionState = {
    test: state.test ?? null,
    athlete: state.athlete ?? null,
    recording: state.recording === true,
    reps: typeof state.reps === "number" ? state.reps : 0,
    queued: typeof state.queued === "number" ? state.queued : 0,
    poseFresh: state.poseFresh === true,
    angles: state.angles && typeof state.angles === "object" ? state.angles : {},
  };

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create(
      {
        model: "claude-opus-4-8",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: RESULT_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: JSON.stringify({ typed: text, session: sessionState }),
          },
        ],
      },
      { timeout: 15_000 },
    );

    const block = response.content.find((b) => b.type === "text");
    const result = clampResult(block ? JSON.parse(block.text) : null);
    if (!result) {
      return NextResponse.json({ error: "Resolver returned no result." }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[axis-resolver]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Resolver unavailable." }, { status: 503 });
  }
}
