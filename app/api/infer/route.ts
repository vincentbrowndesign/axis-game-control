import { NextResponse } from "next/server"
import { runTemporalEngine } from "@/lib/engine/temporalEngine"
import type { Run } from "@/lib/run/runState"

type TrackSignal = {
  id: string
  side: "home" | "away"
  result: "make" | "miss"
  time: number
  order: number
  interval: number
}

type TrackMoment = {
  id: string
  label: "HOT" | "COLD" | "SPURT" | "SWING" | "BREAK"
  name: string
  summary: string
  start: number
  end: number
  signalIds: string[]
}

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

function asSignal(value: unknown): TrackSignal | null {
  if (!value || typeof value !== "object") return null

  const signal = value as Partial<TrackSignal>
  const side = signal.side === "away" ? "away" : signal.side === "home" ? "home" : null
  const result =
    signal.result === "miss" ? "miss" : signal.result === "make" ? "make" : null

  if (!side || !result || typeof signal.id !== "string") return null

  return {
    id: signal.id,
    side,
    result,
    time: typeof signal.time === "number" ? signal.time : 0,
    order: typeof signal.order === "number" ? signal.order : 0,
    interval: typeof signal.interval === "number" ? signal.interval : 0,
  }
}

function localTrack(signals: TrackSignal[]): TrackMoment[] {
  const moments: TrackMoment[] = []

  for (let start = 0; start < signals.length; start += 1) {
    const cluster = [signals[start]]

    for (let end = start + 1; end < signals.length; end += 1) {
      const next = signals[end]
      const previous = cluster[cluster.length - 1]

      if (next.time - cluster[0].time > 40_000) break
      if (
        next.side === previous.side ||
        next.result === previous.result ||
        next.time - previous.time <= 8_000
      ) {
        cluster.push(next)
      }
    }

    if (cluster.length < 3) continue

    const makes = cluster.filter((signal) => signal.result === "make").length
    const misses = cluster.length - makes
    const swings = cluster.filter(
      (signal, index) => index > 0 && signal.side !== cluster[index - 1].side
    ).length
    const label: TrackMoment["label"] =
      misses >= 4 ? "BREAK" : misses >= 3 ? "COLD" : swings >= 2 ? "SWING" : makes >= 3 ? "SPURT" : "HOT"
    const first = cluster[0]
    const last = cluster[cluster.length - 1]

    moments.push({
      id: `track-${first.id}-${last.id}`,
      label,
      name:
        label === "COLD"
          ? "Cold Stretch"
          : label === "BREAK"
            ? "Flow Break"
          : label === "SWING"
            ? "Momentum Swing"
            : label === "SPURT"
              ? "Home Spurt"
              : "Hot Window",
      summary: `${cluster.length} signals`,
      start: first.time,
      end: last.time,
      signalIds: cluster.map((signal) => signal.id),
    })
  }

  return moments.slice(-4).reverse()
}

function runFromTrackBody(body: Record<string, unknown>, signals: TrackSignal[]): Run {
  const run = body.run && typeof body.run === "object" ? (body.run as Partial<Run>) : {}

  return {
    id: typeof run.id === "string" ? run.id : "track-run",
    home: typeof run.home === "string" ? run.home : "Home",
    away: typeof run.away === "string" ? run.away : "Away",
    startedAt: typeof run.startedAt === "number" ? run.startedAt : Date.now(),
    pausedMs: typeof run.pausedMs === "number" ? run.pausedMs : 0,
    signals: signals.map((signal) => ({
      id: signal.id,
      side: signal.side,
      result: signal.result,
      time: signal.time,
    })),
    moments: [],
    memories: [],
  }
}

function cleanMoment(value: unknown, fallback: TrackMoment): TrackMoment {
  if (!value || typeof value !== "object") return fallback

  const moment = value as Partial<TrackMoment>
  const allowed = new Set(["HOT", "COLD", "SPURT", "SWING", "BREAK"])
  const label = allowed.has(String(moment.label))
    ? (moment.label as TrackMoment["label"])
    : fallback.label

  return {
    id: typeof moment.id === "string" ? moment.id : fallback.id,
    label,
    name:
      typeof moment.name === "string" && moment.name.trim()
        ? moment.name.trim().slice(0, 32)
        : fallback.name,
    summary:
      typeof moment.summary === "string" && moment.summary.trim()
        ? moment.summary.trim().slice(0, 54)
        : fallback.summary,
    start: typeof moment.start === "number" ? moment.start : fallback.start,
    end: typeof moment.end === "number" ? moment.end : fallback.end,
    signalIds: Array.isArray(moment.signalIds)
      ? moment.signalIds.filter((id): id is string => typeof id === "string").slice(0, 12)
      : fallback.signalIds,
  }
}

async function inferTrack(body: Record<string, unknown>) {
  const signals = Array.isArray(body.signals)
    ? body.signals.flatMap((value) => {
        const signal = asSignal(value)

        return signal ? [signal] : []
      })
    : []
  const fallback = localTrack(signals)
  const run = runFromTrackBody(body, signals)
  const temporal = runTemporalEngine(run)

  if (!process.env.OPENAI_API_KEY || signals.length < 3) {
    return {
      moments: temporal.moments.length ? temporal.moments : fallback,
      state: temporal.state,
      analysis: temporal.analysis,
      system: temporal.system,
      source: "local",
    }
  }

  try {
    const { default: OpenAI } = await import("openai")
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_TRACK_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You label basketball system plus-minus signal clusters. Return only JSON. Keep labels short and human. Allowed moment labels: HOT, COLD, SPURT, SWING, BREAK. Interpret structural gain/loss, continuity, pressure, interruptions, and sequence flow. No analytics jargon.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Cluster positive/negative structural signal sequence into replay memories.",
            outputShape:
              '{ "moments": [{ "id": string, "label": "HOT|COLD|SPURT|SWING|BREAK", "name": string, "summary": string, "start": number, "end": number, "signalIds": string[] }] }',
            run: body.run,
            signals,
            moments: body.moments,
            temporal: {
              state: temporal.state,
              system: {
                label: temporal.system.label,
                summary: temporal.system.summary,
                structuralIntegrity: temporal.system.structuralIntegrity,
                pressure: temporal.system.pressure,
                netValue: temporal.system.netValue,
                events: temporal.system.events.map((event) => ({
                  id: event.id,
                  team: event.team,
                  outcome: event.outcome,
                  process: event.process,
                  context: event.context,
                  missRisk: event.missRisk,
                  timestamp: event.timestamp,
                  value: event.value,
                })),
              },
              analysis: {
                frequency: temporal.analysis.frequency,
                recency: temporal.analysis.recency,
                continuity: temporal.analysis.continuity,
                interruption: temporal.analysis.interruption,
                responseDelay: temporal.analysis.responseDelay,
                signalDensity: temporal.analysis.signalDensity,
                unanswered: temporal.analysis.unanswered,
                clusteredMisses: temporal.analysis.clusteredMisses,
                currentDroughtMs: temporal.analysis.currentDroughtMs,
                alternatingInstability: temporal.analysis.alternatingInstability,
                acceleration: temporal.analysis.acceleration,
              },
              detectedMoments: temporal.moments,
            },
          }),
        },
      ],
    })
    const text = response.choices[0]?.message?.content || "{}"
    const parsed = JSON.parse(text) as { moments?: unknown[] }
    const defaultMoment: TrackMoment = fallback[0] || {
      id: "track-sequence",
      label: "HOT",
      name: "Replay Window",
      summary: `${signals.length} signals`,
      start: signals[0]?.time || 0,
      end: signals[signals.length - 1]?.time || 0,
      signalIds: signals.map((signal) => signal.id).slice(0, 12),
    }
    const moments = Array.isArray(parsed.moments)
      ? parsed.moments
          .slice(0, 4)
          .map((moment, index) => cleanMoment(moment, fallback[index] || defaultMoment))
      : fallback

    return {
      moments: moments.length ? moments : fallback,
      state: temporal.state,
      analysis: temporal.analysis,
      system: temporal.system,
      source: "openai",
    }
  } catch (error) {
    console.error(error)

    return {
      moments: temporal.moments.length ? temporal.moments : fallback,
      state: temporal.state,
      analysis: temporal.analysis,
      system: temporal.system,
      source: "local",
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body?.type === "track") {
      const track = await inferTrack(body)

      return NextResponse.json({
        track,
      })
    }

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
