import { NextResponse } from "next/server"

type CheckpointResult = {
  clock: string | null
  period: number | null
  scoreAway: number | null
  scoreHome: number | null
}

const EMPTY_RESULT: CheckpointResult = {
  clock: null,
  period: null,
  scoreAway: null,
  scoreHome: null,
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { image?: unknown } | null
  const image = typeof body?.image === "string" ? body.image : ""

  if (!image.startsWith("data:image/")) {
    return NextResponse.json({ error: "No checkpoint image.", result: EMPTY_RESULT }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OCR checkpoint not configured.", result: EMPTY_RESULT, status: "not_configured" }, { status: 200 })
  }

  try {
    const { default: OpenAI } = await import("openai")
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await client.chat.completions.create({
      messages: [
        {
          content:
            "You read cheap gym basketball scoreboards. Return only JSON shaped exactly as {\"scoreHome\":number|null,\"scoreAway\":number|null,\"period\":number|null,\"clock\":\"M:SS\"|null}. If unsure, use null. Do not include raw OCR text.",
          role: "system",
        },
        {
          content: [
            {
              text: "Extract the live scoreboard checkpoint. Favor seven-segment digits. Return structured JSON only.",
              type: "text",
            },
            {
              image_url: {
                url: image,
              },
              type: "image_url",
            },
          ],
          role: "user",
        },
      ],
      model: process.env.OPENAI_OCR_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
    })

    const content = response.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(content) as Partial<CheckpointResult>
    const result = normalizeCheckpoint(parsed)

    return NextResponse.json({ result, status: "ok" })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: "Checkpoint unreadable.", result: EMPTY_RESULT, status: "unreadable" }, { status: 200 })
  }
}

function normalizeCheckpoint(input: Partial<CheckpointResult>): CheckpointResult {
  return {
    clock: normalizeClock(input.clock),
    period: normalizePeriod(input.period),
    scoreAway: normalizeScore(input.scoreAway),
    scoreHome: normalizeScore(input.scoreHome),
  }
}

function normalizeScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 200 ? Math.round(value) : null
}

function normalizePeriod(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 8 ? Math.round(value) : null
}

function normalizeClock(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{1,2}:\d{2}$/.test(trimmed) ? trimmed : null
}
