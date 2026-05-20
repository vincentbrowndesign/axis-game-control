import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { uploadTrainingFrameToRoboflow } from "@/lib/roboflowTraining"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UploadBody = {
  training_memory_id?: string
}

export async function POST(request: Request) {
  let memoryId = ""

  try {
    const body = (await request.json().catch(() => ({}))) as UploadBody
    memoryId = body.training_memory_id || ""
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

    const memory = await supabase
      .from("training_memories")
      .select("*")
      .eq("id", memoryId)
      .maybeSingle()

    if (memory.error || !memory.data) {
      return NextResponse.json(
        {
          ok: false,
          error: "TRAINING_MEMORY_NOT_FOUND",
        },
        {
          status: memory.error ? 500 : 404,
        }
      )
    }

    await supabaseAdmin
      .from("training_memories")
      .update({
        roboflow_status: "pending",
      })
      .eq("id", memoryId)

    const frameResponse = await fetch(memory.data.frame_url)
    if (!frameResponse.ok) {
      throw new Error("TRAINING_FRAME_UNAVAILABLE")
    }

    const frameBlob = await frameResponse.blob()
    const roboflow = await uploadTrainingFrameToRoboflow({
      id: memoryId,
      label: memory.data.label,
      frame: frameBlob,
    })

    if (roboflow.status === "pending") {
      return NextResponse.json({
        ok: true,
        memory: memory.data,
        roboflow_status: "pending",
      })
    }

    if (roboflow.status === "failed") {
      const failed = await supabaseAdmin
        .from("training_memories")
        .update({
          roboflow_status: "failed",
          roboflow_response: roboflow.response,
        })
        .eq("id", memoryId)
        .select("*")
        .single()

      return NextResponse.json(
        {
          ok: false,
          memory: failed.data,
          error: "ROBOFLOW_UPLOAD_FAILED",
        },
        {
          status: 502,
        }
      )
    }

    const updated = await supabaseAdmin
      .from("training_memories")
      .update({
        roboflow_status: "uploaded",
        roboflow_response: roboflow.response,
      })
      .eq("id", memoryId)
      .select("*")
      .single()

    return NextResponse.json({
      ok: true,
      memory: updated.data,
    })
  } catch (error) {
    if (memoryId) {
      await supabaseAdmin
        .from("training_memories")
        .update({
          roboflow_status: "failed",
          roboflow_response: {
            error: error instanceof Error ? error.message : "ROBOFLOW_UPLOAD_FAILED",
          },
        })
        .eq("id", memoryId)
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "ROBOFLOW_UPLOAD_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}
