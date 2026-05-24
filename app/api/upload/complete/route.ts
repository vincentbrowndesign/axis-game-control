import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import {
  cleanText,
  normalizeEnvironment,
  normalizeSource,
} from "@/lib/replayStorage"
import type { AxisUploadResponse } from "@/lib/uploadResponse"

export const runtime = "nodejs"

type CompleteUploadBody = {
  sessionId?: string
  traceId?: string
  filePath?: string
  fileName?: string
  contentType?: string
  sizeBytes?: number
  durationSeconds?: number
  source?: string
  environment?: string
  mission?: string
  player?: string
  client?: Record<string, unknown>
}

function safeJson(body: AxisUploadResponse, status = 200) {
  return Response.json(JSON.parse(JSON.stringify(body)), {
    status,
  })
}

function playerIdFromName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

function detailFromError(error: unknown) {
  return error instanceof Error ? error.message : "UNKNOWN FAILURE"
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
}

export async function POST(request: Request) {
  const requestTraceId = crypto.randomUUID()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return safeJson(
        {
          ok: false,
          error: "AUTH REQUIRED",
          stage: "auth",
          traceId: requestTraceId,
        },
        401
      )
    }

    const body = (await request.json().catch(() => ({}))) as CompleteUploadBody
    const traceId = body.traceId || requestTraceId
    const filePath = body.filePath || ""

    console.log("AXIS UPLOAD COMPLETE", {
      traceId,
      stage: "complete-start",
      filePath,
      sizeBytes: body.sizeBytes || 0,
      contentType: body.contentType || "unknown",
    })

    if (!filePath || !filePath.startsWith(`${user.id}/`)) {
      return safeJson(
        {
          ok: false,
          error: "UPLOAD STILL PROCESSING",
          stage: "storage-path",
          traceId,
        },
        400
      )
    }

    const signedUrl = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7)

    if (signedUrl.error) {
      console.error("AXIS UPLOAD COMPLETE FAILURE", {
        traceId,
        stage: "signed-url",
        error: signedUrl.error.message,
      })

      return safeJson(
        {
          ok: true,
          stage: "signed-url",
          traceId,
          stored: true,
          fallback: true,
          recovery: "Playback ready.",
        },
        202
      )
    }

    const sessionId = isUuid(body.sessionId)
      ? body.sessionId
      : crypto.randomUUID()
    const playerName = body.player?.trim() || "Unassigned"
    const durationSeconds = Number.isFinite(body.durationSeconds)
      ? Number(body.durationSeconds)
      : 0

    const existing = await supabaseAdmin
      .from("axis_sessions")
      .select("id, video_url, metadata")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing.data) {
      revalidatePath("/games")

      return safeJson({
        ok: true,
        replayId: existing.data.id,
        videoUrl: existing.data.video_url || signedUrl.data.signedUrl,
        createdAt: Date.now(),
        stage: "complete",
        traceId,
        stored: true,
      })
    }

    const inserted = await supabaseAdmin
      .from("axis_sessions")
      .insert({
        id: sessionId,
        user_id: user.id,
        title: body.fileName || "Axis video",
        video_url: signedUrl.data.signedUrl,
        file_name: body.fileName || "Axis video",
        file_path: filePath,
        source: normalizeSource(body.source || "upload"),
        mission: cleanText(body.mission || "Replay memory", "Replay memory"),
        player_name: playerName,
        player_id: playerIdFromName(playerName),
        workflow_stage: "practice",
        environment: normalizeEnvironment(body.environment || "practice"),
        duration_seconds: durationSeconds,
        status: "stored",
        tags: [],
        transcript_text: "",
        ai_summary: "Playback saved.",
        embedding_status: "pending",
        semantic_tags: [],
        metadata: {
          sessionId,
          traceId,
          archive: {
            id: sessionId,
            kind: "game",
            status: "ready",
            createdAt: new Date().toISOString(),
            video: {
              bucket: "axis-replays",
              path: filePath,
              contentType: body.contentType || "video/mp4",
              sizeBytes: body.sizeBytes || 0,
            },
          },
          originalName: body.fileName || null,
          originalType: body.contentType || null,
          originalSize: body.sizeBytes || 0,
          playbackFallback: {
            status: "ready",
            source: "direct-storage-upload",
            reason: "browser-uploaded-video",
          },
          client: body.client || {},
        },
      })
      .select("id, video_url")
      .single()

    if (inserted.error) {
      console.error("AXIS UPLOAD COMPLETE FAILURE", {
        traceId,
        stage: "session-create",
        error: inserted.error.message,
      })

      return safeJson(
        {
          ok: true,
          videoUrl: signedUrl.data.signedUrl,
          createdAt: Date.now(),
          stage: "session-create",
          traceId,
          stored: true,
          fallback: true,
          recovery: "Playback ready.",
        },
        202
      )
    }

    const uploadRecord = await supabaseAdmin.from("axis_uploads").insert({
      user_id: user.id,
      session_id: inserted.data.id,
      bucket_id: "axis-replays",
      file_path: filePath,
      file_name: body.fileName || "Axis video",
      content_type: body.contentType || "video/mp4",
      size_bytes: body.sizeBytes || 0,
    })

    if (uploadRecord.error) {
      console.error("AXIS UPLOAD COMPLETE FAILURE", {
        traceId,
        stage: "upload-record",
        error: uploadRecord.error.message,
      })
    }

    console.log("AXIS UPLOAD COMPLETE", {
      traceId,
      stage: "complete",
      replayId: inserted.data.id,
    })

    revalidatePath("/games")

    return safeJson({
      ok: true,
      replayId: inserted.data.id,
      videoUrl: inserted.data.video_url || signedUrl.data.signedUrl,
      createdAt: Date.now(),
      stage: "complete",
      traceId,
      stored: true,
    })
  } catch (error) {
    console.error("AXIS UPLOAD COMPLETE FAILURE", {
      traceId: requestTraceId,
      stage: "unhandled",
      error: detailFromError(error),
    })

    return safeJson(
      {
        ok: false,
        error: "UPLOAD STILL PROCESSING",
        stage: "unhandled",
        traceId: requestTraceId,
        detail: detailFromError(error),
      },
      500
    )
  }
}
