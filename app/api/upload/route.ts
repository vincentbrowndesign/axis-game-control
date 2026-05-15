import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  cleanText,
  createStoragePath,
  isSupportedReplayFile,
  normalizeEnvironment,
  normalizeSource,
  sanitizeFileName,
} from "@/lib/replayStorage"

export const runtime = "nodejs"

function axisError(message: string, status = 400) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    }
  )
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return axisError("SIGNAL INTERRUPTED", 401)
    }

    const formData = await req.formData()

    const file = formData.get("file") as File | null
    const duration = Number(formData.get("duration") || 0)

    if (!file) {
      return axisError("MEMORY LOAD FAILED")
    }

    if (!isSupportedReplayFile(file)) {
      return axisError("STORAGE PATH INVALID")
    }

    const sessionId = crypto.randomUUID()
    const safeFileName = sanitizeFileName(file.name)
    const filePath = createStoragePath({
      userId: user.id,
      sessionId,
      fileName: safeFileName,
      type: file.type,
    })
    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || "video/mp4"

    const upload = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      })

    if (upload.error) {
      console.error("STORAGE ERROR:", upload.error)

      return NextResponse.json(
        {
          error: "RETRYING INGEST",
        },
        {
          status: 500,
        }
      )
    }

    const signedUrlTtl = 60 * 60 * 24 * 7
    const signedUrl = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(filePath, signedUrlTtl)

    if (signedUrl.error) {
      console.error("SIGNED URL ERROR:", signedUrl.error)
      await supabaseAdmin.storage
        .from("axis-replays")
        .remove([filePath])

      return axisError("MEMORY LOAD FAILED", 500)
    }

    const inserted = await supabaseAdmin
      .from("axis_sessions")
      .insert({
        id: sessionId,
        user_id: user.id,
        title: safeFileName || "Axis Session",
        video_url: signedUrl.data?.signedUrl || null,
        file_name: safeFileName,
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
          originalName: file.name,
          originalType: file.type || null,
          originalSize: file.size,
          signedUrlExpiresIn: signedUrlTtl,
        },
      })
      .select("id, video_url")
      .single()

    if (inserted.error) {
      console.error("SESSION INSERT ERROR:", inserted.error)
      await supabaseAdmin.storage
        .from("axis-replays")
        .remove([filePath])

      return NextResponse.json(
        {
          error: "MEMORY LOAD FAILED",
        },
        {
          status: 500,
        }
      )
    }

    const uploadRecord = await supabaseAdmin.from("axis_uploads").insert({
      user_id: user.id,
      session_id: inserted.data.id,
      bucket_id: "axis-replays",
      file_path: filePath,
      file_name: safeFileName,
      content_type: contentType,
      size_bytes: file.size,
    })

    if (uploadRecord.error) {
      console.error("UPLOAD RECORD ERROR:", uploadRecord.error)
    }

    return NextResponse.json({
      success: true,
      id: inserted.data.id,
      fileName: safeFileName,
      type: contentType,
      size: file.size,
      videoUrl: inserted.data.video_url,
    })
  } catch (error) {
    console.error("UPLOAD ERROR:", error)

    return NextResponse.json(
      {
        error: "SIGNAL INTERRUPTED",
      },
      {
        status: 500,
      }
    )
  }
}
