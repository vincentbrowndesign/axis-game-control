import { NextResponse } from "next/server"
import { audioContextFromDeepgram } from "@/lib/engine/audioContext"

function isRemoteUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { mediaUrl?: unknown }

    if (!isRemoteUrl(body.mediaUrl)) {
      return NextResponse.json({
        audioContext: null,
        source: "local",
      })
    }

    if (!process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json({
        audioContext: null,
        source: "disabled",
      })
    }

    const response = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&utterances=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: body.mediaUrl,
        }),
      }
    )

    if (!response.ok) {
      return NextResponse.json({
        audioContext: null,
        source: "failed",
      })
    }

    const data = await response.json()

    return NextResponse.json({
      audioContext: audioContextFromDeepgram(data),
      source: "deepgram",
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json({
      audioContext: null,
      source: "failed",
    })
  }
}
