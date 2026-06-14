import { NextResponse } from "next/server";
import { getResearchClaims } from "../../../../lib/research-witness";

export async function POST(req: Request) {
  try {
    const { query } = await req.json() as { query: string };
    if (!query?.trim()) return NextResponse.json({ claims: [] });
    const claims = await getResearchClaims(query.trim());
    return NextResponse.json({ claims });
  } catch (err) {
    console.error("[research]", err);
    return NextResponse.json({ claims: [] });
  }
}
