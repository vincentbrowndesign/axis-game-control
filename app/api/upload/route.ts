import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  cleanText,
  isSupportedReplayFile,
  normalizeEnvironment,
  normalizeReplayFile,
  normalizeSource,
} from "@/lib/replayStorage"

export const runtime = "nodejs"

function axisError({
  stage,
  error,
  status = 400,
  detail,
}: {
  stage: string
  error: string
  status?: number
  detail?: unknown
}) {
  return safeJson(
    {
      ok: false,
      stage,
      error,
      detail:
        detail instanceof Error
          ? detail.message
          : detail ?? null,
    },
    status
  )
}

function detailFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "UNKNOWN FAILURE"
}

function safeJson(body: Record<string, unknown>, status = 200) {
  return Response.json(
    JSON.parse(
      JSON.stringify(body, (_key, value) =>
        value === undefined ? null : value
      )
    ),
    {
      status,
    }
  )
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
    axis: "UPLOAD ROUTE ACTIVE",
  })
}

export async function POST(request: Request) {
  try {
    console.log("AXIS UPLOAD ROUTE HIT")
    console.log(
      "AXIS UPLOAD BODY SIZE",
      request.headers.get("content-length") || "UNKNOWN"
    )

    if (request.headers.get("x-axis-route-test") === "true") {
      return safeJson({
        ok: true,
        axis: "UPLOAD ROUTE ACTIVE",
      })
    }

    console.log("AXIS UPLOAD START")

    const supabase = await createClient()
    console.log("AXIS SUPABASE CLIENT CREATED")

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    console.log("AXIS AUTH STATE", {
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
      })
    }

    let formData: FormData

    try {
      formData = await request.formData()
    } catch (error) {
      console.error("AXIS FORM DATA ERROR", error)

      return axisError({
        stage: "form-data",
        error: "MEMORY INGEST FAILED",
        status: 400,
        detail: detailFromError(error),
      })
    }

    console.log("AXIS FORM DATA RECEIVED")

    const file = formData.get("file")
    const duration = Number(formData.get("duration") || 0)

    if (!(file instanceof File)) {
      return axisError({
        stage: "file-validation",
        error: "INVALID MEMORY FORMAT",
        status: 400,
        detail: typeof file,
      })
    }

    if (file.size <= 0) {
      return axisError({
        stage: "file-validation",
        error: "EMPTY MEMORY FILE",
        status: 400,
      })
    }

    console.log("AXIS FILE FOUND", file.name, file.type, file.size)

    const normalized = normalizeReplayFile(file)

    console.log("AXIS FILE", file)
    console.log("AXIS NAME", normalized.originalName)
    console.log("AXIS MIME", normalized.mime)
    console.log("AXIS FINAL", normalized.finalName)

    if (!isSupportedReplayFile(file)) {
      return axisError({
        stage: "file-validation",
        error: "INVALID MEMORY FORMAT",
        status: 400,
        detail: {
          name: normalized.originalName,
          mime: normalized.mime,
          extension: normalized.extension,
          size: file.size,
        },
      })
    }

    if (!normalized.finalName) {
      return axisError({
        stage: "file-normalization",
        error: "STORAGE KEY INVALID",
        status: 400,
      })
    }

    const sessionId = crypto.randomUUID()
    const filePath = `${user.id}/${normalized.finalName}`

    if (!filePath.includes("/")) {
      return axisError({
        stage: "file-normalization",
        error: "STORAGE KEY INVALID",
        status: 400,
        detail: filePath,
      })
    }

    console.log("AXIS PATH", filePath)

    let arrayBuffer: ArrayBuffer

    try {
      arrayBuffer = await file.arrayBuffer()
    } catch (error) {
      console.error("AXIS ARRAY BUFFER ERROR", error)

      return axisError({
        stage: "array-buffer",
        error: "MEMORY INGEST FAILED",
        status: 400,
        detail: detailFromError(error),
      })
    }

    console.log("AXIS ARRAY BUFFER READY", arrayBuffer.byteLength)

    const buffer = Buffer.from(arrayBuffer)
    const contentType = normalized.mime || "video/mp4"

    console.log("AXIS STORAGE START")

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
      console.error("AXIS STORAGE TIMEOUT OR FAILURE", error)

      return axisError({
        stage: "storage-upload",
        error: "STORAGE WRITE FAILED",
        status: 500,
        detail: detailFromError(error),
      })
    }

    if (upload.error) {
      console.error("AXIS STORAGE FAILURE", upload.error)

      return axisError({
        stage: "storage-upload",
        error: "STORAGE WRITE FAILED",
        status: 500,
        detail: upload.error.message,
      })
    }

    console.log("AXIS STORAGE SUCCESS", upload.data)

    const signedUrlTtl = 60 * 60 * 24 * 7
    console.log("AXIS SIGNED URL START")

    const signedUrl = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(filePath, signedUrlTtl)

    if (signedUrl.error) {
      console.error("AXIS SIGNED URL FAILURE", signedUrl.error)
      await supabaseAdmin.storage
        .from("axis-replays")
        .remove([filePath])

      return axisError({
        stage: "signed-url",
        error: "MEMORY LOAD FAILED",
        status: 500,
        detail: signedUrl.error.message,
      })
    }

    console.log("AXIS SIGNED URL SUCCESS")
    console.log("AXIS SESSION CREATE START")

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
        player_name: cleanText(
          formData.get("player"),
          "Unassigned"
        ),
        environment: normalizeEnvironment(
          formData.get("environment")
        ),
        duration_seconds: Number.isFinite(duration)
          ? duration
          : 0,
        status: "stored",
        tags: [],
        metadata: {
          originalName: normalized.originalName,
          originalType: normalized.mime || null,
          originalSize: file.size,
          memoryCount: 1,
          lastSignal: "MEMORY STORED",
          archiveStatus: "ACTIVE",
          context: "Replay linked. Session added. Memory available.",
          timeline: [],
          ambientLine: "Replay added to archive.",
          signedUrlExpiresIn: signedUrlTtl,
        },
      })
      .select("id, video_url")
      .single()

    if (inserted.error) {
      console.error("AXIS SESSION CREATE FAILURE", inserted.error)
      await supabaseAdmin.storage
        .from("axis-replays")
        .remove([filePath])

      return axisError({
        stage: "db-session-create",
        error: "DATABASE FAILURE",
        status: 500,
        detail: inserted.error.message,
      })
    }

    console.log("AXIS SESSION CREATED", inserted.data.id)
    console.log("AXIS UPLOAD RECORD CREATE START")

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
      console.error("AXIS UPLOAD RECORD FAILURE", uploadRecord.error)
    } else {
      console.log("AXIS UPLOAD RECORD CREATED")
    }

    const sessionView = {
      id: inserted.data.id,
      createdAt: Date.now(),
      source: normalizeSource(formData.get("source")),
      videoUrl: inserted.data.video_url || "",
      title: normalized.finalName || "Axis Session",
      mission: cleanText(formData.get("mission"), "None"),
      player: cleanText(formData.get("player"), "Unassigned"),
      environment: normalizeEnvironment(formData.get("environment")),
      duration: Number.isFinite(duration) ? duration : 0,
      status: "stored",
      fileName: normalized.finalName,
      tags: [],
      memoryCount: 1,
      lastSignal: "MEMORY STORED",
      archiveStatus: "ACTIVE",
      context: "Replay linked. Session added. Memory available.",
      timeline: [],
      ambientLine: "Replay added to archive.",
    }

    console.log("AXIS FINAL RESPONSE", {
      id: inserted.data.id,
      fileName: normalized.finalName,
      type: contentType,
      size: file.size,
    })

    return safeJson({
      ok: true,
      stage: "complete",
      success: true,
      id: inserted.data.id,
      fileName: normalized.finalName,
      type: contentType,
      size: file.size,
      videoUrl: inserted.data.video_url || "",
      session: sessionView,
      metadataStored: !uploadRecord.error,
      metadataError: uploadRecord.error?.message || null,
    })
  } catch (error) {
    console.error("AXIS UPLOAD ERROR", error)

    return axisError({
      stage: "unhandled",
      error: "MEMORY INGEST FAILED",
      status: 500,
      detail: detailFromError(error),
    })
  }
}
