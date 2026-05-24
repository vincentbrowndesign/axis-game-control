import { NextResponse } from "next/server"
import { retrieveSessionMemory } from "@/lib/mcp/supabaseMemory"
import { normalizeReplay } from "@/lib/normalizeReplay"
import { readProcessingSnapshot } from "@/lib/axis-processing/state"
import { createClient } from "@/lib/supabase/server"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      {
        error: "MEMORY ACCESS REQUIRED",
      },
      {
        status: 401,
      }
    )
  }

  const sessions = await retrieveSessionMemory({
    supabase,
    userId: user.id,
    limit: 120,
  })

  if (sessions.error) {
    return NextResponse.json(
      {
        error: sessions.error.message,
      },
      {
        status: 500,
      }
    )
  }

  const games = (sessions.data || []).map((row) => {
    const normalized = normalizeReplay(row)
    const metadata = asRecord(row.metadata)
    const telemetry = asRecord(metadata.telemetry)
    const timeline = asRecord(metadata.timeline)
    const clips = asRecord(metadata.clips)
    const stats = asRecord(metadata.stats)
    const archive = asRecord(metadata.archive)
    const outputs = asRecord(metadata.outputs)
    const gameSession = asRecord(metadata.gameSession)
    const processing = readProcessingSnapshot(metadata.processing)
    const originalFilename =
      typeof gameSession.originalFilename === "string"
        ? gameSession.originalFilename
        : normalized.fileName || ""
    const fileSize =
      typeof gameSession.fileSize === "number"
        ? gameSession.fileSize
        : typeof metadata.originalSize === "number"
          ? metadata.originalSize
          : 0

    return {
      id: normalized.id,
      videoUrl:
        typeof gameSession.videoUrl === "string"
          ? gameSession.videoUrl
          : normalized.videoUrl,
      originalFilename,
      fileSize,
      title: originalFilename || normalized.title,
      createdAt: normalized.createdAt,
      updatedAt:
        typeof gameSession.updatedAt === "string"
          ? new Date(gameSession.updatedAt).getTime()
          : normalized.createdAt,
      duration: normalized.duration || 0,
      source: normalized.source,
      environment: normalized.environment,
      player: normalized.player,
      status:
        typeof gameSession.status === "string"
          ? gameSession.status
          : normalized.status || "uploaded",
      processing,
      fileName: normalized.fileName || "",
      replayHref: `/replay-native?session=${encodeURIComponent(normalized.id)}`,
      archive: {
        manifest: archive,
        outputs,
        id:
          typeof archive.id === "string"
            ? archive.id
            : normalized.id,
        kind:
          typeof archive.kind === "string"
            ? archive.kind
            : normalized.environment,
        hasVideo: Boolean(row.file_path || normalized.videoUrl),
        hasTelemetry: Boolean(telemetry.path),
        telemetryFrames:
          typeof telemetry.frameCount === "number"
            ? telemetry.frameCount
            : 0,
        timelineEvents:
          typeof timeline.eventCount === "number" ? timeline.eventCount : 0,
        clips:
          typeof clips.count === "number"
            ? clips.count
            : Array.isArray(clips.values)
              ? clips.values.length
              : 0,
        possessions:
          typeof stats.possessionCount === "number"
            ? stats.possessionCount
            : typeof timeline.possessionCount === "number"
              ? timeline.possessionCount
              : 0,
      },
    }
  })

  return NextResponse.json({
    games,
    count: games.length,
  })
}
