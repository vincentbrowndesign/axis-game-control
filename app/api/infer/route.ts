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

    /**
     * TEMP SIGNAL GATE
     *
     * Later:
     * - frame extraction
     * - court detection
     * - player detection
     * - ball tracking
     * - motion analysis
     */

    const basketballSignalDetected = false

    /**
     * NO SIGNAL
     */

    if (!basketballSignalDetected) {
      const response: InferResponse = {
        basketballLikely: false,
        confidence: 0,
        environment: "unknown",
        message: "Waiting for court / ball / players",
        timeline: [],
        suggestions: [],
      }

      return NextResponse.json(response)
    }

    /**
     * SIGNAL DETECTED
     * (placeholder for later)
     */

    const response: InferResponse = {
      basketballLikely: true,
      confidence: 82,
      environment: "basketball",
      message: "Basketball environment detected",
      timeline: [
        {
          time: "0:04",
          label: "BALL MOVE",
          type: "neutral",
        },
        {
          time: "0:05",
          label: "DRIVE",
          type: "attack",
        },
        {
          time: "0:06",
          label: "PAINT TOUCH",
          type: "advantage",
        },
        {
          time: "0:07",
          label: "OPEN",
          type: "reaction",
        },
        {
          time: "0:08",
          label: "SHOT",
          type: "result",
        },
      ],
      suggestions: [
        {
          label: "OPEN?",
          answer: null,
        },
        {
          label: "HELP?",
          answer: null,
        },
        {
          label: "ADVANTAGE?",
          answer: null,
        },
      ],
    }

    return NextResponse.json(response)
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