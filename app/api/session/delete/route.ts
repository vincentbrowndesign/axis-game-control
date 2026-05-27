import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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

    let body: { sessionId?: unknown } = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : ""

    if (!sessionId) {
      return NextResponse.json(
        {
          error: "Session required",
        },
        {
          status: 400,
        }
      )
    }

    const existing = await supabase
      .from("axis_sessions")
      .select("file_path, metadata")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single<{ file_path: string | null; metadata: Record<string, unknown> | null }>()

    if (existing.error) {
      return NextResponse.json(
        {
          error: existing.error.message,
        },
        {
          status: 404,
        }
      )
    }

    await supabaseAdmin
      .from("axis_uploads")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id)

    const deleted = await supabase
      .from("axis_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id)

    if (deleted.error) {
      return NextResponse.json(
        {
          error: deleted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    const metadata =
      existing.data.metadata && typeof existing.data.metadata === "object"
        ? existing.data.metadata
        : {}
    const telemetry =
      metadata.telemetry && typeof metadata.telemetry === "object"
        ? (metadata.telemetry as Record<string, unknown>)
        : {}
    const timeline =
      metadata.timeline && typeof metadata.timeline === "object"
        ? (metadata.timeline as Record<string, unknown>)
        : {}
    const clips =
      metadata.clips && typeof metadata.clips === "object"
        ? (metadata.clips as Record<string, unknown>)
        : {}
    const archive =
      metadata.archive && typeof metadata.archive === "object"
        ? (metadata.archive as Record<string, unknown>)
        : {}
    const archiveAssets =
      archive.assets && typeof archive.assets === "object"
        ? (archive.assets as Record<string, unknown>)
        : {}
    const archiveTelemetry =
      archiveAssets.telemetry && typeof archiveAssets.telemetry === "object"
        ? (archiveAssets.telemetry as Record<string, unknown>)
        : {}
    const archiveTopology =
      archiveAssets.replayTopology && typeof archiveAssets.replayTopology === "object"
        ? (archiveAssets.replayTopology as Record<string, unknown>)
        : {}
    const archiveClips =
      archiveAssets.clips && typeof archiveAssets.clips === "object"
        ? (archiveAssets.clips as Record<string, unknown>)
        : {}
    const telemetryPath =
      typeof telemetry.path === "string" ? telemetry.path : ""
    const timelinePath =
      typeof timeline.path === "string" ? timeline.path : ""
    const archiveTelemetryPath =
      typeof archiveTelemetry.path === "string" ? archiveTelemetry.path : ""
    const archiveTopologyPath =
      typeof archiveTopology.path === "string" ? archiveTopology.path : ""
    const archiveClipPaths = Array.isArray(archiveClips.paths)
      ? archiveClips.paths.filter(
          (path): path is string => typeof path === "string" && path.length > 0
        )
      : []
    const clipPaths = Array.isArray(clips.values)
      ? clips.values
          .filter((clip): clip is Record<string, unknown> =>
            Boolean(clip) && typeof clip === "object"
          )
          .map((clip) => clip.path)
          .filter((path): path is string => typeof path === "string" && path.length > 0)
      : []
    const paths = [
      existing.data.file_path,
      telemetryPath,
      timelinePath,
      archiveTelemetryPath,
      archiveTopologyPath,
      ...clipPaths,
      ...archiveClipPaths,
    ].filter((path): path is string => Boolean(path))

    if (paths.length > 0) {
      await supabaseAdmin.storage
        .from("axis-replays")
        .remove(paths)
    }

    revalidatePath("/")

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error("DELETE SESSION ERROR:", error)

    return NextResponse.json(
      {
        error: "Delete failed",
      },
      {
        status: 500,
      }
    )
  }
}
