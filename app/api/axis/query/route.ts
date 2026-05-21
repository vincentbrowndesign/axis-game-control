import { NextResponse } from "next/server"
import { runAxisIntelligence, type AxisIntelligenceRequest } from "@/lib/axis/intelligence"

export async function POST(request: Request) {
  const body = (await request.json()) as AxisIntelligenceRequest
  const output = await runAxisIntelligence(body)
  return NextResponse.json(output)
}
