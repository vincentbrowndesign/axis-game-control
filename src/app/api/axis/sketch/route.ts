export const runtime = "nodejs";

const SKETCH_SYSTEM = `You generate clean SVG diagrams for sports coaching. Basketball half-courts, movement arrows, spacing diagrams, decision trees.

Rules:
- Output SVG ONLY. No explanation. No markdown. No code blocks. No backticks.
- Always start with: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 320" width="440" height="320">
- Always end with: </svg>
- White background rect: <rect width="440" height="320" fill="#ffffff"/>
- Stroke color: #1a1a1a. No other colors except white fills for player circles.
- Stroke widths: 1.5px details, 2px main elements, 2.5px court outline
- No gradients, no shadows, no complex clip paths
- Player circles: r=13, fill="white" stroke="#1a1a1a" stroke-width="2". Letter label centered inside (font-size="11" font-family="Georgia, serif" text-anchor="middle" dominant-baseline="central")
- Ball: small filled circle r=5 fill="#1a1a1a"
- Arrows: path or polyline with marker-end pointing to a small arrowhead. Define a marker in <defs>: <marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#1a1a1a"/></marker>
- Keep element count under 30
- Font: Georgia, serif for all labels. font-size="10" for small labels, font-size="12" for main ones

Half-court coordinate reference (basket at top, sideline at bottom):
- Basket/rim: (220, 58) — small circle r=7
- Paint (lane): rect x=167 y=58 width=106 height=110, no fill, stroke
- Free throw line: line at y=168 from x=167 to x=273
- 3-point arc: path approximation — large arc from roughly (58,220) through (220,38) to (382,220)
- Left wing: around (80, 185)
- Right wing: around (360, 185)
- Left corner: around (40, 295)
- Right corner: around (400, 295)
- Top of key: around (220, 215)
- Left elbow: around (167, 168)
- Right elbow: around (273, 168)
- Mid-range left: around (120, 150)
- Mid-range right: around (320, 150)

Draw cleanly. Be precise. Return only the SVG.`;

export async function POST(req: Request) {
  let body: { description?: string; threadId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const description = body.description?.trim();
  if (!description) return Response.json({ error: "No description" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "No API key" }, { status: 503 });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2500,
        system: SKETCH_SYSTEM,
        messages: [{ role: "user", content: `Draw: ${description}` }],
      }),
    });

    if (!res.ok) {
      console.error("[axis/sketch] Anthropic error", res.status);
      return Response.json({ error: "Sketch generation failed" }, { status: 500 });
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>;
    };
    const raw = data.content?.find((c) => c.type === "text")?.text ?? "";

    const start = raw.indexOf("<svg");
    const end = raw.lastIndexOf("</svg>") + 6;
    const svg = start >= 0 && end > start ? raw.slice(start, end) : "";

    return Response.json({ svg });
  } catch (err) {
    console.error("[axis/sketch] error", (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
