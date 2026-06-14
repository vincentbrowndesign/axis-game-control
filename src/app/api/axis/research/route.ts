import { NextResponse } from "next/server";
import { getResearchClaims } from "../../../../lib/research-witness";

export const runtime = "nodejs";

export interface EvidenceCard {
  source: string;
  summary: string;
  relevance: string;
  url?: string;
}

const COMPRESS_SYSTEM = `You receive raw search results for a sports development query. Extract up to 3 pieces of evidence that directly support the query.

Rules:
- Max 3. Return fewer if fewer are relevant.
- Skip: Wikipedia, Spotify, YouTube, Instagram, TikTok, Twitter, Facebook, Reddit, news sites, product pages, e-commerce. Only keep sports science, coaching, biomechanics, or athletic development sources.
- summary: 1 sentence. What the source actually says or found.
- relevance: 1 sentence. Why this matters to the player's intent.
- source: bare domain only (e.g. "ncbi.nlm.nih.gov")

Return JSON only: {"evidence":[{"source":"...","summary":"...","relevance":"...","url":"..."}]}

No markdown. No explanation. JSON only.`;

async function compressEvidence(
  query: string,
  rawResults: Array<{ url: string; title?: string; content: string }>,
): Promise<EvidenceCard[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const resultsText = rawResults
    .map((r, i) => `[${i + 1}] URL: ${r.url}\nTitle: ${r.title ?? ""}\nContent: ${r.content.slice(0, 400)}`)
    .join("\n\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: COMPRESS_SYSTEM,
      messages: [{ role: "user", content: `Query: "${query}"\n\nResults:\n${resultsText}` }],
    }),
  });

  if (!response.ok) {
    console.error("[research/compress]", response.status);
    return [];
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";

  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as { evidence?: EvidenceCard[] };
    return Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 3) : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json() as { query: string };
    if (!query?.trim()) return NextResponse.json({ evidence: [] });

    const claims = await getResearchClaims(query.trim());
    if (claims.length === 0) return NextResponse.json({ evidence: [] });

    const rawResults = claims.map((c) => ({
      url: c.url ?? "",
      title: c.title,
      content: c.claim,
    }));

    const evidence = await compressEvidence(query.trim(), rawResults);
    return NextResponse.json({ evidence });
  } catch (err) {
    console.error("[research]", err);
    return NextResponse.json({ evidence: [] });
  }
}
