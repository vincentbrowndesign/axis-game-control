export interface ResearchClaim {
  source: string;
  title?: string;
  claim: string;
  url?: string;
  confidence?: number;
}

interface TavilyResult {
  url: string;
  title?: string;
  content: string;
  score?: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export async function getResearchClaims(
  intent: string
): Promise<ResearchClaim[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: intent,
      search_depth: "advanced",
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily error: ${response.status} ${response.statusText}`);
  }

  const data: TavilyResponse = await response.json();

  return data.results.map((r) => ({
    source: new URL(r.url).hostname,
    title: r.title,
    claim: r.content.trim(),
    url: r.url,
    confidence: r.score,
  }));
}

// First objective — remove before production
if (require.main === module) {
  getResearchClaims("reading defenders basketball").then((claims) =>
    console.log(claims)
  );
}
