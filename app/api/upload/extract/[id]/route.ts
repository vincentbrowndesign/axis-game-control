import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
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

export async function POST(_request: Request, context: Context) {
  const traceId = crypto.randomUUID()

  try {
    const { id } = await context.params
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
    const extractionQueue = asRecord(metadata.extractionQueue)
    const attempts =
      typeof extractionQueue.attempts === "number"
        ? extractionQueue.attempts + 1
        : 1

    await supabaseAdmin
      .from("axis_sessions")
      .update({
        metadata: {
          ...metadata,
          memoryExtractionStatus: "poster-retry-running",
          extractionQueue: {
            ...extractionQueue,
            status: "running",
            attempts,
            traceId,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

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
      await supabaseAdmin
        .from("axis_sessions")
        .update({
          metadata: {
            ...metadata,
            memoryExtractionStatus: "queued-for-retry",
            extractionQueue: {
              ...extractionQueue,
              status: "queued",
              attempts,
              nextStage: "poster-frame-retry",
              reason: poster.error || "poster extraction failed",
              attemptedAtSeconds: poster.attemptedAtSeconds,
              traceId,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

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

    await supabaseAdmin
      .from("axis_sessions")
      .update({
        metadata: {
          ...metadata,
          posterPath,
          posterUrl: signedPoster.data.signedUrl,
          memoryExtractionStatus: "poster-ready",
          extractionQueue: {
            ...extractionQueue,
            status: "complete",
            attempts,
            nextStage: null,
            reason: null,
            attemptedAtSeconds: poster.attemptedAtSeconds,
            traceId,
          },
        },
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
