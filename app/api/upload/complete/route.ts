import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import {
  cleanText,
  normalizeEnvironment,
  normalizeSource,
} from "@/lib/replayStorage"
import {
  createProcessingSnapshot,
  readProcessingSnapshot,
} from "@/lib/axis-processing/state"
import {
  deriveProcessingFromJobs,
  ensureJobManifest,
  readJobManifest,
} from "@/lib/axis-processing/jobs"
import { applySessionArchiveManifest } from "@/lib/axis-processing/archive"
import { triggerProcessGameUpload } from "@/lib/axis-processing/triggerClient"
import { startTriggerGameUploadProcessing } from "@/lib/axis-processing/triggerStatus"
import type { AxisUploadResponse } from "@/lib/uploadResponse"

export const runtime = "nodejs"

const ARCHIVE_ERROR = "MEMORY COULD NOT BE ARCHIVED"

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
    const identity = await getAxisRequestIdentity()

    if (!identity) {
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

    if (!filePath || !filePath.startsWith(`${identity.storageKey}/`)) {
      return safeJson(
        {
          ok: false,
          error: ARCHIVE_ERROR,
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
          recovery: "Memory archived.",
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

    const existing = supabaseAdmin
      .from("axis_sessions")
      .select("id, video_url, metadata")
      .eq("id", sessionId)

    const existingQuery = identity.supabaseUserId
      ? existing.eq("user_id", identity.supabaseUserId)
      : existing.eq("clerk_user_id", identity.clerkUserId || "")
    const existingResult = await existingQuery.maybeSingle<{
      id: string
      metadata: Record<string, unknown> | null
      video_url: string | null
    }>()

    if (existingResult.data) {
      const metadata =
        existingResult.data.metadata && typeof existingResult.data.metadata === "object"
          ? existingResult.data.metadata
          : {}
      const currentProcessing = readProcessingSnapshot(metadata.processing)
      const processingJobs = ensureJobManifest(readJobManifest(metadata.processingJobs))
      const processing =
        currentProcessing.state === "COMPLETE"
          ? currentProcessing
          : deriveProcessingFromJobs(processingJobs, traceId)

      const updateExisting = supabaseAdmin
        .from("axis_sessions")
        .update({
          metadata: applySessionArchiveManifest({
            createdAt: Date.now(),
            durationSeconds:
              typeof body.durationSeconds === "number"
                ? body.durationSeconds
                : null,
            fileName: body.fileName || existingResult.data.id,
            filePath,
            id: existingResult.data.id,
            metadata: {
            ...metadata,
            processing,
            processingJobs,
          },
            status: processing.state.toLowerCase(),
            title: body.fileName || "Participation memory",
            updatedAt: new Date().toISOString(),
          }),
          status: processing.state.toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingResult.data.id)

      const scopedUpdate = identity.supabaseUserId
        ? updateExisting.eq("user_id", identity.supabaseUserId)
        : updateExisting.eq("clerk_user_id", identity.clerkUserId || "")
      await scopedUpdate

      await enqueueAndStartProcessing({
        clerkUserId: identity.clerkUserId,
        sessionId: existingResult.data.id,
        traceId,
        userId: identity.supabaseUserId,
      })

      revalidatePath("/")

      return safeJson({
        ok: true,
        replayId: existingResult.data.id,
        videoUrl: existingResult.data.video_url || signedUrl.data.signedUrl,
        createdAt: Date.now(),
        stage: "complete",
        traceId,
        stored: true,
      })
    }

    const baseMetadata = {
      sessionId,
      traceId,
      archive: {
        id: sessionId,
        kind: "game",
        status: "queued",
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
      processing: createProcessingSnapshot({
        state: "QUEUED",
        traceId,
      }),
      processingJobs: ensureJobManifest(),
      client: body.client || {},
    }

    const inserted = await supabaseAdmin
      .from("axis_sessions")
      .insert({
        id: sessionId,
        clerk_user_id: identity.clerkUserId,
        user_id: identity.supabaseUserId,
        title: body.fileName || "Participation memory",
        video_url: signedUrl.data.signedUrl,
        file_name: body.fileName || "Participation memory",
        file_path: filePath,
        source: normalizeSource(body.source || "upload"),
        mission: cleanText(body.mission || "Replay memory", "Replay memory"),
        player_name: playerName,
        player_id: playerIdFromName(playerName),
        workflow_stage: "practice",
        environment: normalizeEnvironment(body.environment || "practice"),
        duration_seconds: durationSeconds,
        status: "queued",
        tags: [],
        transcript_text: "",
        ai_summary: "Participation memory archived.",
        embedding_status: "pending",
        semantic_tags: [],
        metadata: applySessionArchiveManifest({
          createdAt: Date.now(),
          durationSeconds,
          fileName: body.fileName || "Participation memory",
          filePath,
          id: sessionId,
          metadata: baseMetadata,
          status: "queued",
          title: body.fileName || "Participation memory",
          updatedAt: new Date().toISOString(),
        }),
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
          recovery: "Memory archived.",
        },
        202
      )
    }

    const uploadRecord = await supabaseAdmin.from("axis_uploads").insert({
      clerk_user_id: identity.clerkUserId,
      user_id: identity.supabaseUserId,
      session_id: inserted.data.id,
      bucket_id: "axis-replays",
      file_path: filePath,
      file_name: body.fileName || "Participation memory",
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

    await enqueueAndStartProcessing({
      clerkUserId: identity.clerkUserId,
      sessionId: inserted.data.id,
      traceId,
      userId: identity.supabaseUserId,
    })

    revalidatePath("/")

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
        error: ARCHIVE_ERROR,
        stage: "unhandled",
        traceId: requestTraceId,
        detail: detailFromError(error),
      },
      500
    )
  }
}

async function enqueueAndStartProcessing({
  clerkUserId,
  sessionId,
  traceId,
  userId,
}: {
  clerkUserId?: string | null
  sessionId: string
  traceId?: string
  userId?: string | null
}) {
  await startTriggerGameUploadProcessing({
    clerkUserId,
    sessionId,
    traceId,
    userId,
  })

  await triggerProcessGameUpload({
    clerkUserId,
    sessionId,
    traceId,
    userId,
  })
}
