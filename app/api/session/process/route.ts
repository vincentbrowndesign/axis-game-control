import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import {
  buildReplayTrackingPipeline,
  type PlayableArea,
  type RawRfDetectionFrame,
} from "@/lib/basketball/trackingPipeline"
import {
  createProcessingSnapshot,
  type AxisProcessingState,
} from "@/lib/axis-processing/state"
import { applySessionArchiveManifest } from "@/lib/axis-processing/archive"
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

async function writeProcessingState({
  detail,
  metadata,
  sessionId,
  state,
  traceId,
  userId,
}: {
  detail?: string
  metadata: Record<string, unknown>
  sessionId: string
  state: AxisProcessingState
  traceId: string
  userId: string
}) {
  const processing = createProcessingSnapshot({
    detail,
    previous: asRecord(metadata.processing),
    state,
    traceId,
  })

  metadata.processing = processing

  await supabaseAdmin
    .from("axis_sessions")
    .update({
      metadata,
      status: state.toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()
  let activeMetadata: Record<string, unknown> | null = null
  let activeSessionId = ""
  let activeUserId = ""

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
    activeSessionId = sessionId

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

    const metadata = asRecord(session.data.metadata)
    activeMetadata = metadata
    activeUserId = user.id
    await writeProcessingState({
      metadata,
      sessionId,
      state: "PROCESSING",
      traceId,
      userId: user.id,
    })

    await writeProcessingState({
      detail: `${detections.length} detection frames received.`,
      metadata,
      sessionId,
      state: "TRACKING",
      traceId,
      userId: user.id,
    })

    const output = buildReplayTrackingPipeline({
      frames: detections,
      playableArea: body.playableArea,
    })
    const telemetryPath = `${user.id}/telemetry/${sessionId}-axis-telemetry.ndjson`
    const timelinePath = `${user.id}/timelines/${sessionId}-axis-timeline.json`

    await writeProcessingState({
      detail: `${output.telemetry.length} telemetry frames prepared.`,
      metadata,
      sessionId,
      state: "GENERATING_REPLAY",
      traceId,
      userId: user.id,
    })

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
      processing: createProcessingSnapshot({
        detail: "Replay memory prepared.",
        previous: asRecord(metadata.processing),
        state: "GENERATING_STATS",
        traceId,
      }),
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

    await writeProcessingState({
      detail: "Traditional stats prepared.",
      metadata: nextMetadata,
      sessionId,
      state: "GENERATING_STATS",
      traceId,
      userId: user.id,
    })

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

    await writeProcessingState({
      detail: "Finding clip windows.",
      metadata: nextMetadata,
      sessionId,
      state: "GENERATING_CLIPS",
      traceId,
      userId: user.id,
    })

    const finalClipResult = sourceSession.data
      ? await exportSessionClips({
          maxClips: 5,
          session: {
            ...sourceSession.data,
            metadata: nextMetadata,
          },
        })
      : { clips: [], errors: [], plan: [] }

    const finalMetadata = {
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
    }

    await writeProcessingState({
      detail: "Preparing recap output.",
      metadata: finalMetadata,
      sessionId,
      state: "GENERATING_BROADCAST",
      traceId,
      userId: user.id,
    })

    finalMetadata.processing = createProcessingSnapshot({
      detail: "Replay, clips, stats, and recap output are ready.",
      previous: asRecord(finalMetadata.processing),
      state: "COMPLETE",
      traceId,
    })

    const archivedFinalMetadata = applySessionArchiveManifest({
      durationSeconds: sourceSession.data?.duration_seconds ?? null,
      filePath: sourceSession.data?.file_path ?? null,
      id: sessionId,
      metadata: finalMetadata,
      status: "complete",
      title: sourceSession.data?.title || "Game media",
      updatedAt: new Date().toISOString(),
    })

    await supabaseAdmin
      .from("axis_sessions")
      .update({
        metadata: archivedFinalMetadata,
        status: "complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id)

    revalidatePath("/")

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
    if (activeMetadata && activeSessionId && activeUserId) {
      await writeProcessingState({
        detail: error instanceof Error ? error.message : "Processing failed.",
        metadata: activeMetadata,
        sessionId: activeSessionId,
        state: "FAILED",
        traceId,
        userId: activeUserId,
      }).catch(() => undefined)
    }

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
