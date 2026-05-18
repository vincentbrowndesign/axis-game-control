import { createClient } from "@/lib/supabase/server"
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
import type { AxisUploadResponse } from "@/lib/uploadResponse"

export const runtime = "nodejs"

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

function recoverableUploadResponse({
  traceId,
  stage,
  replayId,
  videoUrl,
  recovery,
  detail,
}: {
  traceId: string
  stage: string
  replayId?: string
  videoUrl?: string | null
  recovery: string
  detail?: unknown
}) {
  logUploadFailure(traceId, stage, {
    stored: true,
    recovery,
    detail:
      detail instanceof Error
        ? detail.message
        : detail ?? null,
  })

  const body: AxisUploadResponse = {
    ok: true,
    replayId,
    videoUrl: videoUrl || "",
    createdAt: Date.now(),
    stage,
    traceId,
    stored: true,
    fallback: true,
    recovery,
  }

  return safeJson(body, 202)
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

    const supabase = await createClient()
    logUploadStage(traceId, "supabase-client-created")

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    logUploadStage(traceId, "auth-state", {
      authenticated: Boolean(user),
      userId: user?.id || null,
      error: userError?.message || null,
    })

    if (userError || !user) {
      return axisError({
        stage: "auth",
        error: "AUTH REQUIRED",
        status: 401,
        detail: userError?.message,
        traceId,
      })
    }

    let formData: FormData

    try {
      formData = await request.formData()
    } catch (error) {
      return axisError({
        stage: "form-data",
        error: "UPLOAD STILL PROCESSING",
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
        error: "UPLOAD STILL PROCESSING",
        status: 400,
        detail: typeof file,
        traceId,
      })
    }

    if (file.size <= 0) {
      return axisError({
        stage: "file-validation",
        error: "UPLOAD STILL PROCESSING",
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
        error: "UPLOAD STILL PROCESSING",
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
        error: "UPLOAD STILL PROCESSING",
        status: 400,
        traceId,
      })
    }

    const sessionId = crypto.randomUUID()
    const filePath = `${user.id}/${normalized.finalName}`

    if (!filePath.includes("/")) {
      return axisError({
        stage: "file-normalization",
        error: "UPLOAD STILL PROCESSING",
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
        error: "UPLOAD STILL PROCESSING",
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
        error: "UPLOAD STILL PROCESSING",
        status: 500,
        detail: detailFromError(error),
        traceId,
      })
    }

    if (upload.error) {
      return axisError({
        stage: "storage-upload",
        error: "UPLOAD STILL PROCESSING",
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

    const signedUrl = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(filePath, signedUrlTtl)

    if (signedUrl.error) {
      return recoverableUploadResponse({
        traceId,
        stage: "signed-url",
        recovery: "Video uploaded, rebuilding anchors.",
        detail: signedUrl.error.message,
      })
    }

    logUploadStage(traceId, "signed-url-complete")
    logUploadStage(traceId, "session-create-start")
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

    logUploadStage(traceId, "extraction-stage", {
      durationSeconds: safeDuration,
      candidateCount: candidateLandmarks.length,
    })
    logUploadStage(traceId, "keyframe-generation-stage", {
      mode: "client-progressive",
      candidateCount: candidateLandmarks.length,
    })

    const inserted = await supabaseAdmin
      .from("axis_sessions")
      .insert({
        id: sessionId,
        user_id: user.id,
        title: normalized.finalName || "Axis Session",
        video_url: signedUrl.data?.signedUrl || null,
        file_name: normalized.finalName,
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
        status: "stored",
        tags: [],
        transcript_text: candidateLandmarks
          .map((landmark) => `[${landmark.timestamp}] ${landmark.title}`)
          .join("\n"),
        ai_summary: "Candidate replay moments ready for coach reinforcement.",
        embedding_status: "pending",
        semantic_tags: candidateLandmarks.map((landmark) => landmark.title),
        metadata: {
          traceId,
          uploadPipeline: {
            stage: "session-created",
            stored: true,
            client: clientMetadata,
          },
          originalName: normalized.originalName,
          originalType: normalized.mime || null,
          originalSize: file.size,
          signedUrlExpiresIn: signedUrlTtl,
          workflowStage,
          candidateLandmarks,
          captionLandmarks: candidateLandmarks,
          memoryExtractionStatus: "candidate-landmarks-ready",
          correctionTimelineEvents: [
            makeTimelineEvent("CLIP_CAPTURED", "Clip captured"),
          ],
        },
      })
      .select("id, video_url")
      .single()

    if (inserted.error) {
      const orphanRecord = await supabaseAdmin.from("axis_uploads").insert({
        user_id: user.id,
        bucket_id: "axis-replays",
        file_path: filePath,
        file_name: normalized.finalName,
        content_type: contentType,
        size_bytes: file.size,
      })

      if (orphanRecord.error) {
        logUploadFailure(traceId, "orphan-upload-record", {
          detail: orphanRecord.error.message,
        })
      }

      return recoverableUploadResponse({
        traceId,
        stage: "db-session-create",
        videoUrl: signedUrl.data?.signedUrl || "",
        recovery: "Video uploaded, rebuilding anchors.",
        detail: inserted.error.message,
      })
    }

    logUploadStage(traceId, "session-create-complete", {
      sessionId: inserted.data.id,
      hasVideoUrl: Boolean(inserted.data.video_url),
    })
    logUploadStage(traceId, "upload-record-create-start")

    const uploadRecord = await supabaseAdmin.from("axis_uploads").insert({
      user_id: user.id,
      session_id: inserted.data.id,
      bucket_id: "axis-replays",
      file_path: filePath,
      file_name: normalized.finalName,
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

    const createdAt = Date.now()

    logUploadStage(traceId, "final-completion", {
      replayId: inserted.data.id,
      hasVideoUrl: Boolean(inserted.data.video_url),
      createdAt,
    })

    const body: AxisUploadResponse = {
      ok: true,
      replayId: inserted.data.id,
      videoUrl: inserted.data.video_url || "",
      createdAt,
      stage: "complete",
      traceId,
      stored: true,
    }

    return safeJson(body)
  } catch (error) {
    return axisError({
      stage: "unhandled",
      error: "UPLOAD STILL PROCESSING",
      status: 500,
      detail: detailFromError(error),
      traceId,
    })
  }
}
