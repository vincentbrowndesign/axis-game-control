import { NextResponse } from "next/server"

import { getAxisEvents } from "@/lib/axisSessions"
import {
  buildSessionAnalysis,
  saveSessionAnalysis,
} from "@/lib/axisAnalysis"

type Props = {
  params: Promise<{
    id: string
  }>
}

export async function POST(
  _request: Request,
  { params }: Props
) {
  try {
    const { id } = await params

    const events = await getAxisEvents(id)

    const analysis = buildSessionAnalysis(id, events)

    const saved = await saveSessionAnalysis(analysis)

    return NextResponse.json({
      ok: true,
      analysis: saved,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to analyze session",
      },
      { status: 500 }
    )
  }
}