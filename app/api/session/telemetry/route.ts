import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { parseTelemetryStream } from "@/lib/axis-replay/telemetry"
import { sanitizeFileName } from "@/lib/replayStorage"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, traceId, error: "AUTH REQUIRED" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const sessionId = String(formData.get("sessionId") || "")
    const file = formData.get("telemetry")

    if (!sessionId || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, traceId, error: "TELEMETRY REQUIRED" },
        { status: 400 }
      )
    }

    const session = await supabase
      .from("axis_sessions")
      .select("id, metadata")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; metadata: Record<string, unknown> | null }>()

    if (session.error || !session.data) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION NOT FOUND" },
        { status: 404 }
      )
    }

    const text = await file.text()
    const parsed = parseTelemetryStream(text)

    if (parsed.length === 0) {
      return NextResponse.json(
        { ok: false, traceId, error: "TELEMETRY EMPTY" },
        { status: 400 }
      )
    }

    const telemetryPath = `${user.id}/telemetry/${sessionId}-${sanitizeFileName(
      file.name || "telemetry.json"
    )}`

    const uploaded = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(telemetryPath, text, {
        cacheControl: "3600",
        contentType: file.type || "application/json",
        upsert: true,
      })

    if (uploaded.error) {
      return NextResponse.json(
        { ok: false, traceId, error: uploaded.error.message },
        { status: 500 }
      )
    }

    const metadata = asRecord(session.data.metadata)
    const archive = asRecord(metadata.archive)

    const updated = await supabaseAdmin
      .from("axis_sessions")
      .update({
        metadata: {
          ...metadata,
          archive: {
            ...archive,
            telemetry: {
              bucket: "axis-replays",
              path: telemetryPath,
              frameCount: parsed.length,
              durationMs: parsed.at(-1)?.timestamp_ms ?? 0,
              attachedAt: new Date().toISOString(),
            },
          },
          telemetry: {
            path: telemetryPath,
            fileName: file.name || "telemetry.json",
            contentType: file.type || "application/json",
            sizeBytes: file.size,
            frameCount: parsed.length,
            durationMs: parsed.at(-1)?.timestamp_ms ?? 0,
            attachedAt: new Date().toISOString(),
            traceId,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id)

    if (updated.error) {
      return NextResponse.json(
        { ok: false, traceId, error: updated.error.message },
        { status: 500 }
      )
    }

    revalidatePath("/")

    return NextResponse.json({
      ok: true,
      traceId,
      telemetry: {
        path: telemetryPath,
        frameCount: parsed.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        traceId,
        error: error instanceof Error ? error.message : "TELEMETRY FAILED",
      },
      { status: 500 }
    )
  }
}
