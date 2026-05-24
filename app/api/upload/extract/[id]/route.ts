import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  createProcessingSnapshot,
  type AxisProcessingState,
} from "@/lib/axis-processing/state"
import { applySessionArchiveManifest } from "@/lib/axis-processing/archive"
import { extractPosterFrame } from "@/lib/video/extractPosterFrame"

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

function fileExtension(filePath: string) {
  return filePath.includes(".")
    ? filePath.split(".").pop() || "mov"
    : "mov"
}

async function writeProcessingState({
  detail,
  id,
  metadata,
  state,
  traceId,
}: {
  detail?: string
  id: string
  metadata: Record<string, unknown>
  state: AxisProcessingState
  traceId: string
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
    .eq("id", id)
}

export async function POST(_request: Request, context: Context) {
  const traceId = crypto.randomUUID()
  let activeId = ""
  let activeMetadata: Record<string, unknown> | null = null

  try {
    const { id } = await context.params
    activeId = id
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          traceId,
          stage: "auth",
        },
        { status: 401 }
      )
    }

    console.log("AXIS DELAYED EXTRACTION", {
      traceId,
      stage: "start",
      sessionId: id,
      userId: user.id,
    })

    const session = await supabaseAdmin
      .from("axis_sessions")
      .select("id, user_id, file_path, duration_seconds, metadata")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (session.error || !session.data?.file_path) {
      console.error("AXIS DELAYED EXTRACTION FAILURE", {
        traceId,
        stage: "session-lookup",
        error: session.error?.message || "missing file path",
      })

      return NextResponse.json(
        {
          ok: false,
          traceId,
          stage: "session-lookup",
        },
        { status: 404 }
      )
    }

    const metadata = asRecord(session.data.metadata)
    activeMetadata = metadata
    const extractionQueue = asRecord(metadata.extractionQueue)
    const attempts =
      typeof extractionQueue.attempts === "number"
        ? extractionQueue.attempts + 1
        : 1

    metadata.memoryExtractionStatus = "poster-retry-running"
    metadata.extractionQueue = {
      ...extractionQueue,
      status: "running",
      attempts,
      traceId,
    }

    await writeProcessingState({
      id,
      metadata,
      state: "PROCESSING",
      traceId,
    })

    await writeProcessingState({
      detail: "Preparing replay preview.",
      id,
      metadata,
      state: "GENERATING_REPLAY",
      traceId,
    })

    const downloaded = await supabaseAdmin.storage
      .from("axis-replays")
      .download(session.data.file_path)

    if (downloaded.error || !downloaded.data) {
      throw new Error(downloaded.error?.message || "storage download failed")
    }

    const sourceBuffer = Buffer.from(await downloaded.data.arrayBuffer())
    const poster = await extractPosterFrame({
      buffer: sourceBuffer,
      extension: fileExtension(session.data.file_path),
      durationSeconds: Number(session.data.duration_seconds || 0),
      timeoutMs: 12000,
    })

    if (!poster.ok || !poster.buffer) {
      metadata.memoryExtractionStatus = "queued-for-retry"
      metadata.extractionQueue = {
        ...extractionQueue,
        status: "queued",
        attempts,
        nextStage: "poster-frame-retry",
        reason: poster.error || "poster extraction failed",
        attemptedAtSeconds: poster.attemptedAtSeconds,
        traceId,
      }

      await writeProcessingState({
        detail: "Replay preview queued for another attempt.",
        id,
        metadata,
        state: "QUEUED",
        traceId,
      })

      return NextResponse.json({
        ok: true,
        traceId,
        stage: "queued-for-retry",
      })
    }

    const posterPath = `${user.id}/posters/${id}.jpg`
    const uploaded = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(posterPath, poster.buffer, {
        contentType: "image/jpeg",
        upsert: true,
      })

    if (uploaded.error) {
      throw new Error(uploaded.error.message)
    }

    const signedPoster = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(posterPath, 60 * 60 * 24 * 7)

    if (signedPoster.error) {
      throw new Error(signedPoster.error.message)
    }

    metadata.posterPath = posterPath
    metadata.posterUrl = signedPoster.data.signedUrl
    metadata.memoryExtractionStatus = "poster-ready"
    metadata.extractionQueue = {
      ...extractionQueue,
      status: "complete",
      attempts,
      nextStage: null,
      reason: null,
      attemptedAtSeconds: poster.attemptedAtSeconds,
      traceId,
    }
    metadata.broadcast = {
      status: "prepared",
      type: "game-recap-shell",
      updatedAt: new Date().toISOString(),
    }
    metadata.processing = createProcessingSnapshot({
      detail: "Replay media is ready.",
      previous: asRecord(metadata.processing),
      state: "COMPLETE",
      traceId,
    })

    const archivedMetadata = applySessionArchiveManifest({
      durationSeconds: Number(session.data.duration_seconds || 0),
      filePath: session.data.file_path,
      id,
      metadata,
      status: "complete",
      title: "Game media",
      updatedAt: new Date().toISOString(),
    })

    await supabaseAdmin
      .from("axis_sessions")
      .update({
        metadata: archivedMetadata,
        status: "complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    console.log("AXIS DELAYED EXTRACTION", {
      traceId,
      stage: "complete",
      sessionId: id,
      posterPath,
    })

    return NextResponse.json({
      ok: true,
      traceId,
      stage: "poster-ready",
      posterUrl: signedPoster.data.signedUrl,
    })
  } catch (error) {
    if (activeId && activeMetadata) {
      await writeProcessingState({
        detail: error instanceof Error ? error.message : "Processing failed.",
        id: activeId,
        metadata: activeMetadata,
        state: "FAILED",
        traceId,
      }).catch(() => undefined)
    }

    console.error("AXIS DELAYED EXTRACTION FAILURE", {
      traceId,
      stage: "unhandled",
      error: error instanceof Error ? error.message : "unknown",
    })

    return NextResponse.json({
      ok: true,
      traceId,
      stage: "queued-for-retry",
    })
  }
}
