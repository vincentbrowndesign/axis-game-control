import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { uploadTrainingFrameToRoboflow } from "@/lib/roboflowTraining"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const labels = new Set(["ball", "rim", "make", "miss", "release", "other"])

function numberFromForm(value: FormDataEntryValue | null) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function nullableNumberFromForm(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : ""
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "ACCESS_REQUIRED",
        },
        {
          status: 401,
        }
      )
    }

    const formData = await request.formData()
    const image = formData.get("image")
    const sessionId = asString(formData.get("sessionId"))
    const label = asString(formData.get("label")).toLowerCase()
    const replayTime = numberFromForm(formData.get("replayTime"))
    const videoUrl = asString(formData.get("videoUrl")) || null
    const eventType = asString(formData.get("eventType")) || null
    const clipStart = nullableNumberFromForm(formData.get("clipStart"))
    const clipEnd = nullableNumberFromForm(formData.get("clipEnd"))
    const metadataText = asString(formData.get("metadata"))
    const metadata = metadataText ? JSON.parse(metadataText) : {}

    if (!sessionId || !labels.has(label) || !(image instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "TRAINING_MEMORY_INVALID",
        },
        {
          status: 400,
        }
      )
    }

    const session = await supabase
      .from("sessions")
      .select("id, operator_id")
      .eq("id", sessionId)
      .eq("operator_id", user.id)
      .maybeSingle()

    if (session.error || !session.data) {
      return NextResponse.json(
        {
          ok: false,
          error: "SESSION_NOT_FOUND",
        },
        {
          status: session.error ? 500 : 404,
        }
      )
    }

    const id = crypto.randomUUID()
    const storagePath = `${sessionId}/${id}.jpg`
    const bytes = await image.arrayBuffer()

    const upload = await supabaseAdmin.storage
      .from("training-frames")
      .upload(storagePath, bytes, {
        contentType: image.type || "image/jpeg",
        upsert: false,
      })

    if (upload.error) {
      return NextResponse.json(
        {
          ok: false,
          error: upload.error.message,
        },
        {
          status: 500,
        }
      )
    }

    const publicUrl = supabaseAdmin.storage
      .from("training-frames")
      .getPublicUrl(storagePath).data.publicUrl

    const inserted = await supabaseAdmin
      .from("training_memories")
      .insert({
        id,
        session_id: sessionId,
        label,
        frame_url: publicUrl,
        video_url: videoUrl,
        replay_time: replayTime,
        clip_start: clipStart,
        clip_end: clipEnd,
        event_type: eventType,
        metadata,
        roboflow_status: "pending",
      })
      .select("*")
      .single()

    if (inserted.error) {
      await supabaseAdmin.storage.from("training-frames").remove([storagePath])

      return NextResponse.json(
        {
          ok: false,
          error: inserted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    let memory = inserted.data
    const roboflow = await uploadTrainingFrameToRoboflow({
      id,
      label,
      frame: image,
    })

    if (roboflow.status !== "pending") {
      const updated = await supabaseAdmin
        .from("training_memories")
        .update({
          roboflow_status: roboflow.status,
          roboflow_response: roboflow.response,
        })
        .eq("id", id)
        .select("*")
        .single()

      if (updated.data) {
        memory = updated.data
      }
    }

    return NextResponse.json({
      ok: true,
      memory,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "TRAINING_MEMORY_SAVE_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}
