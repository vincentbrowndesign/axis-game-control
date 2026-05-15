import { NextResponse } from "next/server"

type InferResponse = {
  basketballLikely: boolean
  confidence: number
  environment: string
  message: string
  timeline: {
    time: string
    label: string
    type: string
  }[]
  suggestions: {
    label: string
    answer: boolean | null
  }[]
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const playbackId = body?.playbackId

    if (!playbackId) {
      return NextResponse.json(
        {
          error: "Missing playbackId",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      basketballLikely: false,
      confidence: 0,
      environment: "unknown",
      message: "Signal extraction runs after replay loads.",
      timeline: [],
      suggestions: [],
    } satisfies InferResponse)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: "Inference failed",
      },
      { status: 500 }
    )
  }
}
