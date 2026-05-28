import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  cleanText,
  isSupportedReplayFile,
  normalizeEnvironment,
  normalizeReplayFile,
  normalizeSource,
} from "@/lib/replayStorage"
import { makeTimelineEvent } from "@/lib/axis/reinforcement"
import { extractReplayLandmarks } from "@/lib/axis-ai/extractReplayLandmarks"
import { mapWorkflowStage } from "@/lib/axis-ai/mapWorkflowStage"
import { triggerProcessGameUpload } from "@/lib/axis-processing/triggerClient"
import { startTriggerGameUploadProcessing } from "@/lib/axis-processing/triggerStatus"
import type { AxisUploadResponse } from "@/lib/uploadResponse"

export const runtime = "nodejs"

const ARCHIVE_ERROR = "MEMORY COULD NOT BE ARCHIVED"

type UploadLogDetail = Record<string, unknown>

function logUploadStage(
  traceId: string,
  stage: string,
  detail: UploadLogDetail = {}
) {
  console.log("AXIS UPLOAD PIPELINE", {
    traceId,
    stage,
    ...detail,
  })
}

function logUploadFailure(
  traceId: string,
  stage: string,
  detail: UploadLogDetail = {}
) {
  console.error("AXIS UPLOAD PIPELINE FAILURE", {
    traceId,
    stage,
    ...detail,
  })
}

function axisError({
  stage,
  error,
  status = 400,
  detail,
  traceId,
  stored = false,
  recovery,
}: {
  stage: string
  error: string
  status?: number
  detail?: unknown
  traceId?: string
  stored?: boolean
  recovery?: string
}) {
  logUploadFailure(traceId || "NO_TRACE", stage, {
    error,
    stored,
    detail:
      detail instanceof Error
        ? detail.message
        : detail ?? null,
  })

  const body: AxisUploadResponse = {
    ok: false,
    error,
    stage,
    traceId,
    stored,
    recovery,
    detail:
      detail instanceof Error
        ? detail.message
        : typeof detail === "string"
          ? detail
          : detail == null
            ? undefined
            : JSON.stringify(detail),
  }

  return safeJson(body, status)
}

async function createSignedReplayUrl(filePath: string, ttl: number) {
  return supabaseAdmin.storage
    .from("axis-replays")
    .createSignedUrl(filePath, ttl)
}

function detailFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "UNKNOWN FAILURE"
}

function safeJson(body: AxisUploadResponse, status = 200) {
  return Response.json(
    JSON.parse(JSON.stringify(body)),
    {
      status,
    }
  )
}

function playerIdFromName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  stage: string
) {
  let timeout: ReturnType<typeof setTimeout>

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${stage} TIMEOUT`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([operation, timeoutPromise])
  } finally {
    clearTimeout(timeout!)
  }
}

export async function GET() {
  return safeJson({
    ok: true,
  })
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()

  try {
    logUploadStage(traceId, "route-hit", {
      contentLength: request.headers.get("content-length") || "UNKNOWN",
      contentType: request.headers.get("content-type") || "UNKNOWN",
      userAgent: request.headers.get("user-agent") || "UNKNOWN",
    })

    if (request.headers.get("x-axis-route-test") === "true") {
      return safeJson({
        ok: true,
        traceId,
        stage: "route-test",
      })
    }

    logUploadStage(traceId, "upload-start")

    const identity = await getAxisRequestIdentity()

    logUploadStage(traceId, "auth-state", {
      authenticated: Boolean(identity),
      clerkUserId: identity?.clerkUserId || null,
      kind: identity?.kind || null,
      supabaseUserId: identity?.supabaseUserId || null,
    })

    if (!identity) {
      return axisError({
        stage: "auth",
        error: "AUTH REQUIRED",
        status: 401,
        traceId,
      })
    }

    let formData: FormData

    try {
      formData = await request.formData()
    } catch (error) {
      return axisError({
        stage: "form-data",
        error: ARCHIVE_ERROR,
        status: 400,
        detail: detailFromError(error),
        traceId,
      })
    }

    logUploadStage(traceId, "form-data-received")

    const file = formData.get("file")
    const duration = Number(formData.get("duration") || 0)
    const clientTraceId = cleanText(formData.get("clientTraceId"), traceId)
    const clientMetadata = {
      clientTraceId,
      clientName: cleanText(formData.get("clientName"), "unknown"),
      clientType: cleanText(formData.get("clientType"), "unknown"),
      clientSize: Number(formData.get("clientSize") || 0),
      clientLastModified: Number(formData.get("clientLastModified") || 0),
      clientUserAgent: cleanText(formData.get("clientUserAgent"), "unknown"),
      clientIsMobile: formData.get("clientIsMobile") === "true",
      clientIsIOS: formData.get("clientIsIOS") === "true",
      clientIsSafari: formData.get("clientIsSafari") === "true",
      clientViewport: cleanText(formData.get("clientViewport"), "unknown"),
    }

    if (!(file instanceof File)) {
      return axisError({
        stage: "file-validation",
        error: ARCHIVE_ERROR,
        status: 400,
        detail: typeof file,
        traceId,
      })
    }

    if (file.size <= 0) {
      return axisError({
        stage: "file-validation",
        error: ARCHIVE_ERROR,
        status: 400,
        traceId,
      })
    }

    logUploadStage(traceId, "file-metadata", {
      name: file.name || "unnamed",
      type: file.type || "missing",
      size: file.size,
      duration,
      ...clientMetadata,
    })

    const normalized = normalizeReplayFile(file)

    logUploadStage(traceId, "file-normalized", {
      originalName: normalized.originalName,
      mime: normalized.mime || "missing",
      extension: normalized.extension,
      finalName: normalized.finalName,
    })

    if (!isSupportedReplayFile(file)) {
      return axisError({
        stage: "file-validation",
        error: ARCHIVE_ERROR,
        status: 400,
        detail: {
          name: normalized.originalName,
          mime: normalized.mime,
          extension: normalized.extension,
          size: file.size,
        },
        traceId,
      })
    }

    if (!normalized.finalName) {
      return axisError({
        stage: "file-normalization",
        error: ARCHIVE_ERROR,
        status: 400,
        traceId,
      })
    }

    const sessionId = crypto.randomUUID()
    const filePath = `${identity.storageKey}/${sessionId}/${normalized.finalName}`

    if (!filePath.includes("/")) {
      return axisError({
        stage: "file-normalization",
        error: ARCHIVE_ERROR,
        status: 400,
        detail: filePath,
        traceId,
      })
    }

    logUploadStage(traceId, "storage-path-ready", {
      filePath,
    })

    let arrayBuffer: ArrayBuffer

    try {
      logUploadStage(traceId, "blob-conversion-start")
      arrayBuffer = await file.arrayBuffer()
    } catch (error) {
      return axisError({
        stage: "array-buffer",
        error: ARCHIVE_ERROR,
        status: 400,
        detail: detailFromError(error),
        traceId,
      })
    }

    logUploadStage(traceId, "blob-conversion-complete", {
      byteLength: arrayBuffer.byteLength,
    })

    const buffer = Buffer.from(arrayBuffer)
    const contentType = normalized.mime || "video/mp4"

    logUploadStage(traceId, "storage-upload-start", {
      bucket: "axis-replays",
      contentType,
      bytes: buffer.byteLength,
    })

    let upload: Awaited<
      ReturnType<
        ReturnType<typeof supabaseAdmin.storage.from>["upload"]
      >
    >

    try {
      upload = await withTimeout(
        supabaseAdmin.storage
          .from("axis-replays")
          .upload(filePath, buffer, {
            contentType,
            upsert: false,
          }),
        45000,
        "STORAGE UPLOAD"
      )
    } catch (error) {
      return axisError({
        stage: "storage-upload",
        error: ARCHIVE_ERROR,
        status: 500,
        detail: detailFromError(error),
        traceId,
      })
    }

    if (upload.error) {
      return axisError({
        stage: "storage-upload",
        error: ARCHIVE_ERROR,
        status: 500,
        detail: upload.error.message,
        traceId,
      })
    }

    logUploadStage(traceId, "storage-upload-complete", {
      path: upload.data.path,
      fullPath: upload.data.fullPath || null,
    })
    logUploadStage(traceId, "mux-upload-result", {
      status: "not_used",
      reason: "server-storage-upload-path",
    })

    const signedUrlTtl = 60 * 60 * 24 * 7
    logUploadStage(traceId, "signed-url-start", {
      ttl: signedUrlTtl,
    })

    const signedUrl = await createSignedReplayUrl(filePath, signedUrlTtl)

    if (signedUrl.error) {
      return axisError({
        traceId,
        stage: "signed-url",
        error: ARCHIVE_ERROR,
        status: 500,
        stored: true,
        detail: signedUrl.error.message,
      })
    }

    logUploadStage(traceId, "signed-url-complete")
    logUploadStage(traceId, "session-create-start")
    const nowIso = new Date().toISOString()
    const playerName = cleanText(
      formData.get("player"),
      "Unassigned"
    )
    const workflowStage = mapWorkflowStage(
      formData.get("workflowStage") || formData.get("environment")
    )
    const safeDuration = Number.isFinite(duration)
      ? duration
      : 0
    const candidateLandmarks = extractReplayLandmarks({
      durationSeconds: safeDuration,
    })
    const extractionStatus = "queued-for-retry"

    logUploadStage(traceId, "extraction-stage", {
      durationSeconds: safeDuration,
      candidateCount: candidateLandmarks.length,
      status: extractionStatus,
      mode: "background",
    })
    logUploadStage(traceId, "keyframe-generation-stage", {
      mode: "delayed",
      candidateCount: candidateLandmarks.length,
    })

    const inserted = await supabaseAdmin
      .from("axis_sessions")
      .insert({
        id: sessionId,
        clerk_user_id: identity.clerkUserId,
        user_id: identity.supabaseUserId,
        title: normalized.originalName || normalized.finalName || "Axis Session",
        video_url: signedUrl.data?.signedUrl || null,
        file_name: normalized.originalName,
        file_path: filePath,
        source: normalizeSource(formData.get("source")),
        mission: cleanText(formData.get("mission"), "None"),
        player_name: playerName,
        player_id: playerIdFromName(playerName),
        workflow_stage: workflowStage,
        environment: normalizeEnvironment(
          formData.get("environment")
        ),
        duration_seconds: safeDuration,
        status: "uploaded",
        tags: [],
        transcript_text: candidateLandmarks
          .map((landmark) => `[${landmark.timestamp}] ${landmark.title}`)
          .join("\n"),
        ai_summary: "Replay memory preserved in Axis History.",
        embedding_status: "pending",
        semantic_tags: candidateLandmarks.map((landmark) => landmark.title),
        metadata: {
          traceId,
          uploadPipeline: {
            stage: "session-created",
            stored: true,
            client: clientMetadata,
          },
          gameSession: {
            id: sessionId,
            userId: identity.clerkUserId || identity.supabaseUserId,
            videoUrl: signedUrl.data?.signedUrl || "",
            uploadPath: filePath,
            originalFilename: normalized.originalName,
            fileSize: file.size,
            status: "uploaded",
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          originalName: normalized.originalName,
          originalFilename: normalized.originalName,
          originalType: normalized.mime || null,
          originalSize: file.size,
          fileSize: file.size,
          uploadedAt: nowIso,
          uploadStatus: "uploaded",
          signedUrlExpiresIn: signedUrlTtl,
          posterUrl: null,
          posterPath: null,
          workflowStage,
          candidateLandmarks,
          captionLandmarks: candidateLandmarks,
          memoryExtractionStatus: extractionStatus,
          extractionQueue: {
            status: "queued",
            attempts: 0,
            nextStage: "poster-frame-retry",
            reason: "playback-returned-before-extraction",
            attemptedAtSeconds: [],
          },
          playbackFallback: {
            status: "ready",
            source: "signed-storage-url",
            reason: "participation-memory-preserved",
          },
          correctionTimelineEvents: [
            makeTimelineEvent("CLIP_CAPTURED", "Memory preserved"),
          ],
        },
      })
      .select("id, video_url, created_at, updated_at")
      .single()

    if (inserted.error) {
      const orphanRecord = await supabaseAdmin.from("axis_uploads").insert({
        clerk_user_id: identity.clerkUserId,
        user_id: identity.supabaseUserId,
        bucket_id: "axis-replays",
        file_path: filePath,
        file_name: normalized.originalName,
        content_type: contentType,
        size_bytes: file.size,
      })

      if (orphanRecord.error) {
        logUploadFailure(traceId, "orphan-upload-record", {
          detail: orphanRecord.error.message,
        })
      }

      return axisError({
        traceId,
        stage: "db-session-create",
        error: "MEMORY SAVED WITHOUT SESSION",
        status: 500,
        stored: true,
        detail: inserted.error.message,
      })
    }

    logUploadStage(traceId, "session-create-complete", {
      sessionId: inserted.data.id,
      hasVideoUrl: Boolean(inserted.data.video_url),
    })
    logUploadStage(traceId, "upload-record-create-start")

    const uploadRecord = await supabaseAdmin.from("axis_uploads").insert({
      clerk_user_id: identity.clerkUserId,
      user_id: identity.supabaseUserId,
      session_id: inserted.data.id,
      bucket_id: "axis-replays",
      file_path: filePath,
      file_name: normalized.originalName,
      content_type: contentType,
      size_bytes: file.size,
    })

    if (uploadRecord.error) {
      logUploadFailure(traceId, "upload-record-create", {
        detail: uploadRecord.error.message,
      })
    } else {
      logUploadStage(traceId, "upload-record-create-complete")
    }

    logUploadStage(traceId, "processing-job-create-start", {
      sessionId: inserted.data.id,
    })
    await startTriggerGameUploadProcessing({
      clerkUserId: identity.clerkUserId,
      sessionId: inserted.data.id,
      traceId,
      userId: identity.supabaseUserId,
    })
    logUploadStage(traceId, "processing-job-create-complete", {
      sessionId: inserted.data.id,
      status: "queued",
    })

    try {
      const run = await triggerProcessGameUpload({
        clerkUserId: identity.clerkUserId,
        sessionId: inserted.data.id,
        traceId,
        userId: identity.supabaseUserId,
      })

      logUploadStage(traceId, "trigger-job-created", {
        runId: run.id,
        sessionId: inserted.data.id,
      })
    } catch (error) {
      return axisError({
        detail: detailFromError(error),
        error: "MEMORY SAVED WITHOUT PROCESSING",
        recovery: "Participation memory was saved. Background processing can run later.",
        stage: "trigger-job-create",
        status: 500,
        stored: true,
        traceId,
      })
    }

    const createdAt = inserted.data.created_at
      ? new Date(inserted.data.created_at).getTime()
      : Date.now()
    const updatedAt = inserted.data.updated_at
      ? new Date(inserted.data.updated_at).getTime()
      : createdAt

    logUploadStage(traceId, "final-completion", {
      replayId: inserted.data.id,
      hasVideoUrl: Boolean(inserted.data.video_url),
      createdAt,
      processingStatus: "queued",
      updatedAt,
    })

    const body: AxisUploadResponse = {
      ok: true,
      replayId: inserted.data.id,
      videoUrl: inserted.data.video_url || "",
      filePath,
      fileName: normalized.finalName,
      originalFilename: normalized.originalName,
      sizeBytes: file.size,
      fileSize: file.size,
      createdAt,
      updatedAt,
      stage: "complete",
      status: "uploaded",
      traceId,
      stored: true,
      extractionStatus,
    }

    return safeJson(body)
  } catch (error) {
    return axisError({
      stage: "unhandled",
      error: ARCHIVE_ERROR,
      status: 500,
      detail: detailFromError(error),
      traceId,
    })
  }
}
