import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required",
        },
        {
          status: 401,
        }
      )
    }

    const formData = await req.formData()

    const file = formData.get("file") as File | null
    const source = formData.get("source")
    const duration = Number(formData.get("duration") || 0)
    const environment = formData.get("environment")
    const mission = formData.get("mission")
    const player = formData.get("player")

    if (!file) {
      return NextResponse.json(
        {
          error: "No file uploaded",
        },
        {
          status: 400,
        }
      )
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "mp4"
    const sessionId = crypto.randomUUID()
    const filePath = `${user.id}/${sessionId}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const upload = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(filePath, buffer, {
        contentType: file.type || "video/mp4",
        upsert: false,
      })

    if (upload.error) {
      console.error("STORAGE ERROR:", upload.error)

      return NextResponse.json(
        {
          error: upload.error.message,
        },
        {
          status: 500,
        }
      )
    }

    const signedUrl = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(filePath, 60 * 60 * 24)

    const inserted = await supabaseAdmin
      .from("axis_sessions")
      .insert({
        id: sessionId,
        user_id: user.id,
        title: file.name || "Axis Session",
        video_url: signedUrl.data?.signedUrl || null,
        file_name: file.name,
        file_path: filePath,
        source: source === "camera" ? "camera" : "upload",
        mission:
          typeof mission === "string" && mission
            ? mission
            : "None",
        player_name:
          typeof player === "string" && player
            ? player
            : "Unassigned",
        environment:
          environment === "game" ||
          environment === "mission" ||
          environment === "workout"
            ? environment
            : "practice",
        duration_seconds: Number.isFinite(duration)
          ? duration
          : 0,
        status: "stored",
        metadata: {
          originalType: file.type,
          originalSize: file.size,
        },
      })
      .select("id, video_url")
      .single()

    if (inserted.error) {
      console.error("SESSION INSERT ERROR:", inserted.error)

      return NextResponse.json(
        {
          error: inserted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    await supabaseAdmin.from("axis_uploads").insert({
      user_id: user.id,
      session_id: inserted.data.id,
      bucket_id: "axis-replays",
      file_path: filePath,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
    })

    return NextResponse.json({
      success: true,
      id: inserted.data.id,
      fileName: file.name,
      type: file.type,
      size: file.size,
      videoUrl: inserted.data.video_url,
    })
  } catch (error) {
    console.error("UPLOAD ERROR:", error)

    return NextResponse.json(
      {
        error: "Upload route crashed",
      },
      {
        status: 500,
      }
    )
  }
}
