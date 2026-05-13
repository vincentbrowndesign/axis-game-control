import { NextResponse } from "next/server"

import { inferPossession } from "@/lib/engine/inference"

export async function POST(
  req: Request
) {
  try {
    const body = await req.json()

    const events = body.events || []

    const analysis =
      inferPossession(events)

    return NextResponse.json(
      analysis
    )
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: "analysis failed",
      },
      {
        status: 500,
      }
    )
  }
}