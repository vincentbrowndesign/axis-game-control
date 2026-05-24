import { parseTelemetryStream } from "@/lib/axis-replay/telemetry"
import {
  buildAutoClipPlan,
  type AutoClipPlan,
  type StructuredTimelineLike,
} from "@/lib/replay/autoClips"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { extractClip } from "@/lib/video/extractClip"

type SessionForClipExport = {
  duration_seconds: number | null
  file_path: string | null
  id: string
  metadata: Record<string, unknown> | null
  title: string | null
  user_id: string
}

export type ExportedClip = AutoClipPlan & {
  durationMs: number
  path: string
  sizeBytes: number
  status: "ready"
  url: string
}

export type ClipExportResult = {
  clips: ExportedClip[]
  errors: Array<{ clipId: string; error: string }>
  plan: AutoClipPlan[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export async function exportSessionClips({
  maxClips = 6,
  session,
}: {
  maxClips?: number
  session: SessionForClipExport
}): Promise<ClipExportResult> {
  if (!session.file_path) {
    return { clips: [], errors: [{ clipId: session.id, error: "VIDEO MISSING" }], plan: [] }
  }

  const metadata = asRecord(session.metadata)
  const telemetryMeta = asRecord(metadata.telemetry)
  const timelineMeta = asRecord(metadata.timeline)
  const telemetryPath = text(telemetryMeta.path)
  const timelinePath = text(timelineMeta.path)
  const telemetry = telemetryPath ? await loadTelemetry(telemetryPath) : []
  const timeline = timelinePath ? await loadTimeline(timelinePath) : {}
  const durationMs = Math.max(
    Number(session.duration_seconds || 0) * 1000,
    telemetry.at(-1)?.timestamp_ms ?? 0
  )
  const plan = buildAutoClipPlan({
    durationMs,
    maxClips,
    sessionId: session.id,
    telemetry,
    timeline,
  })

  if (plan.length === 0) return { clips: [], errors: [], plan }

  const signedVideo = await supabaseAdmin.storage
    .from("axis-replays")
    .createSignedUrl(session.file_path, 60 * 60)

  if (signedVideo.error || !signedVideo.data?.signedUrl) {
    return {
      clips: [],
      errors: [{ clipId: session.id, error: signedVideo.error?.message || "VIDEO SIGNING FAILED" }],
      plan,
    }
  }

  const clips: ExportedClip[] = []
  const errors: ClipExportResult["errors"] = []

  for (const item of plan) {
    const extracted = await extractClip({
      durationMs: item.endMs - item.startMs,
      inputUrl: signedVideo.data.signedUrl,
      startMs: item.startMs,
    })

    if (!extracted.ok || !extracted.buffer) {
      errors.push({
        clipId: item.id,
        error: extracted.error || "CLIP EXTRACTION FAILED",
      })
      continue
    }

    const clipPath = `${session.user_id}/clips/${session.id}/${item.fileName}`
    const uploaded = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(clipPath, extracted.buffer, {
        cacheControl: "3600",
        contentType: "video/mp4",
        upsert: true,
      })

    if (uploaded.error) {
      errors.push({
        clipId: item.id,
        error: uploaded.error.message,
      })
      continue
    }

    const signedClip = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(clipPath, 60 * 60 * 24 * 7)

    clips.push({
      ...item,
      durationMs: item.endMs - item.startMs,
      path: clipPath,
      sizeBytes: extracted.buffer.byteLength,
      status: "ready",
      url: signedClip.data?.signedUrl || "",
    })
  }

  return { clips, errors, plan }
}

async function loadTelemetry(path: string) {
  const downloaded = await supabaseAdmin.storage
    .from("axis-replays")
    .download(path)

  if (downloaded.error || !downloaded.data) return []

  return parseTelemetryStream(await downloaded.data.text())
}

async function loadTimeline(path: string): Promise<StructuredTimelineLike> {
  const downloaded = await supabaseAdmin.storage
    .from("axis-replays")
    .download(path)

  if (downloaded.error || !downloaded.data) return {}

  try {
    return JSON.parse(await downloaded.data.text()) as StructuredTimelineLike
  } catch {
    return {}
  }
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
