import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import {
  buildReplayTrackingPipeline,
  type PlayableArea,
  type RawRfDetectionFrame,
} from "@/lib/basketball/trackingPipeline"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { exportSessionClips } from "@/lib/replay/exportClips"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProcessBody = {
  detections?: RawRfDetectionFrame[]
  playableArea?: PlayableArea
  sessionId?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, traceId, error: "AUTH REQUIRED" },
        { status: 401 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as ProcessBody
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    const detections = Array.isArray(body.detections) ? body.detections : []

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION REQUIRED" },
        { status: 400 }
      )
    }

    if (detections.length === 0) {
      return NextResponse.json(
        { ok: false, traceId, error: "DETECTIONS REQUIRED" },
        { status: 400 }
      )
    }

    const session = await supabase
      .from("axis_sessions")
      .select("id, metadata")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; metadata: Record<string, unknown> | null }>()

    if (session.error || !session.data) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION NOT FOUND" },
        { status: 404 }
      )
    }

    const output = buildReplayTrackingPipeline({
      frames: detections,
      playableArea: body.playableArea,
    })
    const telemetryPath = `${user.id}/telemetry/${sessionId}-axis-telemetry.ndjson`
    const timelinePath = `${user.id}/timelines/${sessionId}-axis-timeline.json`

    const telemetryUpload = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(telemetryPath, output.telemetryNdjson, {
        cacheControl: "3600",
        contentType: "application/x-ndjson",
        upsert: true,
      })

    if (telemetryUpload.error) {
      return NextResponse.json(
        { ok: false, traceId, error: telemetryUpload.error.message },
        { status: 500 }
      )
    }

    const timelineJson = JSON.stringify(
      {
        clipWindows: output.timeline.clipWindows,
        events: output.timeline.events,
        possessions: output.timeline.possessions,
        quality: output.quality,
        stats: output.timeline.stats,
      },
      null,
      2
    )
    const timelineUpload = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(timelinePath, timelineJson, {
        cacheControl: "3600",
        contentType: "application/json",
        upsert: true,
      })

    if (timelineUpload.error) {
      return NextResponse.json(
        { ok: false, traceId, error: timelineUpload.error.message },
        { status: 500 }
      )
    }

    const metadata = asRecord(session.data.metadata)
    const archive = asRecord(metadata.archive)

    const nextMetadata = {
      ...metadata,
      archive: {
        ...archive,
        telemetry: {
          bucket: "axis-replays",
          durationMs: output.telemetry.at(-1)?.timestamp_ms ?? 0,
          frameCount: output.telemetry.length,
          path: telemetryPath,
          timelinePath,
          updatedAt: new Date().toISOString(),
        },
      },
      processing: {
        quality: output.quality,
        status: "ready",
        timelinePath,
        traceId,
        updatedAt: new Date().toISOString(),
      },
      telemetry: {
        contentType: "application/x-ndjson",
        durationMs: output.telemetry.at(-1)?.timestamp_ms ?? 0,
        fileName: "axis-telemetry.ndjson",
        frameCount: output.telemetry.length,
        path: telemetryPath,
        sizeBytes: output.telemetryNdjson.length,
        traceId,
      },
      timeline: {
        clipWindowCount: output.timeline.clipWindows.length,
        eventCount: output.timeline.events.length,
        path: timelinePath,
        possessionCount: output.timeline.possessions.length,
        traceId,
      },
      stats: {
        path: timelinePath,
        playerCount: Object.keys(output.timeline.stats.players).length,
        possessionCount: output.timeline.stats.possessions,
        teamCount: Object.keys(output.timeline.stats.teams).length,
        timelineCount: output.timeline.stats.timeline.length,
        traceId,
        updatedAt: new Date().toISOString(),
      },
    }

    const updated = await supabaseAdmin
      .from("axis_sessions")
      .update({
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id)

    if (updated.error) {
      return NextResponse.json(
        { ok: false, traceId, error: updated.error.message },
        { status: 500 }
      )
    }

    const sourceSession = await supabase
      .from("axis_sessions")
      .select("id, user_id, title, file_path, duration_seconds, metadata")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<{
        duration_seconds: number | null
        file_path: string | null
        id: string
        metadata: Record<string, unknown> | null
        title: string | null
        user_id: string
      }>()

    const finalClipResult = sourceSession.data
      ? await exportSessionClips({
          maxClips: 5,
          session: {
            ...sourceSession.data,
            metadata: nextMetadata,
          },
        })
      : { clips: [], errors: [], plan: [] }

    await supabaseAdmin
      .from("axis_sessions")
      .update({
        metadata: {
          ...nextMetadata,
          clips: {
            count: finalClipResult.clips.length,
            errors: finalClipResult.errors,
            generatedAt: new Date().toISOString(),
            plannedCount: finalClipResult.plan.length,
            status: finalClipResult.clips.length > 0 ? "ready" : "empty",
            traceId,
            values: finalClipResult.clips,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id)

    revalidatePath("/games")
    revalidatePath("/replay-native")

    return NextResponse.json({
      ok: true,
      quality: output.quality,
      telemetry: {
        frameCount: output.telemetry.length,
        path: telemetryPath,
      },
      timeline: {
        clipWindowCount: output.timeline.clipWindows.length,
        eventCount: output.timeline.events.length,
        path: timelinePath,
        possessionCount: output.timeline.possessions.length,
      },
      stats: {
        playerCount: Object.keys(output.timeline.stats.players).length,
        possessionCount: output.timeline.stats.possessions,
        teamCount: Object.keys(output.timeline.stats.teams).length,
        timelineCount: output.timeline.stats.timeline.length,
      },
      clips: {
        count: finalClipResult.clips.length,
        errors: finalClipResult.errors.length,
        plannedCount: finalClipResult.plan.length,
      },
      traceId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        traceId,
        error: error instanceof Error ? error.message : "PROCESSING FAILED",
      },
      { status: 500 }
    )
  }
}
