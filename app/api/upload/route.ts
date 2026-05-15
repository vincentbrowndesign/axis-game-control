import { NextResponse } from "next/server"
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

export async function POST(request: Request) {
  try {
    console.log("AXIS UPLOAD START")

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return axisError("SIGNAL INTERRUPTED", 401)
    }

    const formData = await request.formData()
    console.log("AXIS FORM DATA RECEIVED")

    const file = formData.get("file")
    const duration = Number(formData.get("duration") || 0)

    if (!(file instanceof File)) {
      return Response.json(
        {
          error: "INVALID MEMORY FORMAT",
        },
        {
          status: 400,
        }
      )
    }

    console.log("AXIS FILE FOUND")

    const normalized = normalizeReplayFile(file)

    console.log("AXIS FILE", file)
    console.log("AXIS NAME", normalized.originalName)
    console.log("AXIS MIME", normalized.mime)
    console.log("AXIS FINAL", normalized.finalName)

    if (!isSupportedReplayFile(file)) {
      return axisError("INVALID MEMORY FORMAT")
    }

    if (!normalized.finalName) {
      return axisError("STORAGE KEY INVALID")
    }

    const sessionId = crypto.randomUUID()
    const filePath = `${user.id}/${normalized.finalName}`

    if (!filePath.includes("/")) {
      return axisError("STORAGE KEY INVALID")
    }

    console.log("AXIS PATH", filePath)

    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = normalized.mime || "video/mp4"

    const upload = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      })

    if (upload.error) {
      console.error("STORAGE ERROR:", upload.error)

      return Response.json(
        {
          error: "STORAGE KEY INVALID",
          detail: upload.error.message,
        },
        {
          status: 500,
        }
      )
    }

    console.log("AXIS STORAGE SUCCESS")

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

      return Response.json(
        {
          error: "MEMORY LOAD FAILED",
          detail: inserted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    console.log("AXIS SESSION CREATED")

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
      console.error("UPLOAD RECORD ERROR:", uploadRecord.error)
    }

    return Response.json({
      success: true,
      id: inserted.data.id,
      fileName: normalized.finalName,
      type: contentType,
      size: file.size,
      videoUrl: inserted.data.video_url,
    })
  } catch (error) {
    console.error("AXIS UPLOAD ERROR", error)

    return Response.json(
      {
        error: "MEMORY INGEST FAILED",
        detail:
          error instanceof Error
            ? error.message
            : "UNKNOWN FAILURE",
      },
      {
        status: 500,
      }
    )
  }
}
