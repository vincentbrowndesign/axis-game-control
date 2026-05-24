import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { buildMemoryState } from "@/lib/memoryInference"
import { normalizeReplay } from "@/lib/normalizeReplay"
import { readProcessingSnapshot } from "@/lib/axis-processing/state"
import {
  type AxisReplaySession,
} from "@/types/memory"

type Context = {
  params: Promise<{
    id: string
  }>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export async function GET(_req: Request, context: Context) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      {
        error: "MEMORY ACCESS REQUIRED",
      },
      {
        status: 401,
      }
    )
  }

  const { data } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<AxisReplaySession>()

  if (!data) {
    return NextResponse.json(
      {
        error: "MEMORY LOAD FAILED",
      },
      {
        status: 404,
      }
    )
  }

  if (data.file_path) {
    const signed = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(data.file_path, 60 * 60 * 24 * 7)

    data.video_url = signed.data?.signedUrl || data.video_url
  }

  const metadata = asRecord(data.metadata)
  const telemetry = asRecord(metadata.telemetry)
  const timeline = asRecord(metadata.timeline)
  const clips = asRecord(metadata.clips)
  const stats = asRecord(metadata.stats)
  const archive = asRecord(metadata.archive)
  const broadcast = asRecord(metadata.broadcast)
  const outputs = asRecord(metadata.outputs)
  const processing = readProcessingSnapshot(metadata.processing)
  const telemetryPath =
    typeof telemetry.path === "string" ? telemetry.path : ""
  const timelinePath =
    typeof timeline.path === "string" ? timeline.path : ""
  let telemetryUrl = ""
  let timelineUrl = ""

  if (telemetryPath) {
    const signedTelemetry = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(telemetryPath, 60 * 60)

    telemetryUrl = signedTelemetry.data?.signedUrl || ""
  }

  if (timelinePath) {
    const signedTimeline = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(timelinePath, 60 * 60)

    timelineUrl = signedTimeline.data?.signedUrl || ""
  }

  const clipValues = Array.isArray(clips.values)
    ? clips.values.filter(
        (clip): clip is Record<string, unknown> =>
          Boolean(clip) && typeof clip === "object"
      )
    : []
  const replayClips = await Promise.all(
    clipValues.map(async (clip) => {
      const path = typeof clip.path === "string" ? clip.path : ""
      const signed = path
        ? await supabaseAdmin.storage
            .from("axis-replays")
            .createSignedUrl(path, 60 * 60 * 24 * 7)
        : null

      return {
        anchorMs: typeof clip.anchorMs === "number" ? clip.anchorMs : 0,
        durationMs: typeof clip.durationMs === "number" ? clip.durationMs : 0,
        endMs: typeof clip.endMs === "number" ? clip.endMs : 0,
        id: typeof clip.id === "string" ? clip.id : path,
        label: typeof clip.label === "string" ? clip.label : "Replay clip",
        path,
        reason: typeof clip.reason === "string" ? clip.reason : "replay_window",
        startMs: typeof clip.startMs === "number" ? clip.startMs : 0,
        url: signed?.data?.signedUrl || "",
        weight: typeof clip.weight === "number" ? clip.weight : 0,
      }
    })
  )

  const { data: previousData } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("user_id", user.id)
    .neq("id", id)
    .lt("created_at", data.created_at)
    .order("created_at", { ascending: false })
    .returns<AxisReplaySession[]>()

  const session = normalizeReplay(data)
  const previousSessions = (previousData || []).map(normalizeReplay)
  const memoryState = buildMemoryState({
    session,
    previousSessions,
    player: session.player,
  })

  return NextResponse.json({
    session: {
      ...session,
      memoryCount: memoryState.memoryCount,
      lastSignal: memoryState.status,
      archiveStatus: memoryState.archiveStatus,
      context: memoryState.contextLine,
      timeline: memoryState.timelineEvents.map((event) => ({
        time: event.time,
        label: event.label,
        detail: event.body,
        tone: event.tone,
      })),
      ambientLine: memoryState.ambientLine,
      memoryState,
      archive,
      broadcast,
      outputs,
      processing,
      telemetry: telemetryPath
        ? {
            path: telemetryPath,
            url: telemetryUrl,
            fileName:
              typeof telemetry.fileName === "string"
                ? telemetry.fileName
                : "telemetry.json",
            frameCount:
              typeof telemetry.frameCount === "number"
                ? telemetry.frameCount
                : 0,
            durationMs:
              typeof telemetry.durationMs === "number"
                ? telemetry.durationMs
                : 0,
          }
        : null,
      structuredTimeline: timelinePath
        ? {
            clipWindowCount:
              typeof timeline.clipWindowCount === "number"
                ? timeline.clipWindowCount
                : 0,
            eventCount:
              typeof timeline.eventCount === "number"
                ? timeline.eventCount
                : 0,
            path: timelinePath,
            possessionCount:
              typeof timeline.possessionCount === "number"
                ? timeline.possessionCount
                : 0,
            url: timelineUrl,
          }
        : null,
      stats: {
        path: typeof stats.path === "string" ? stats.path : timelinePath,
        playerCount:
          typeof stats.playerCount === "number" ? stats.playerCount : 0,
        possessionCount:
          typeof stats.possessionCount === "number"
            ? stats.possessionCount
            : 0,
        teamCount: typeof stats.teamCount === "number" ? stats.teamCount : 0,
        timelineCount:
          typeof stats.timelineCount === "number" ? stats.timelineCount : 0,
      },
      clips: replayClips,
    },
  })
}
