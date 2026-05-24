import { randomUUID } from "crypto"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import { mkdir, readFile, readdir, rm } from "fs/promises"
import os from "os"
import path from "path"
import {
  buildReplayTrackingPipeline,
  type RawRfDetection,
  type RawRfDetectionFrame,
} from "@/lib/basketball/trackingPipeline"
import { supabaseAdmin } from "@/lib/supabase/admin"

ffmpeg.setFfmpegPath(ffmpegPath as string)

type AxisCvSession = {
  duration_seconds: number | null
  file_path: string | null
  id: string
  title: string | null
  user_id: string
}

type RoboflowPrediction = {
  class?: string
  class_id?: number
  class_name?: string
  confidence?: number
  height?: number
  width?: number
  x?: number
  y?: number
}

type RoboflowResponse = {
  image?: {
    height?: number
    width?: number
  }
  predictions?: RoboflowPrediction[]
}

export type AxisCvProcessingOutput = {
  clips: Record<string, unknown>
  quality: Record<string, unknown>
  stats: Record<string, unknown>
  telemetryNdjson: string
  timeline: Record<string, unknown>
  topology: Record<string, unknown>
  paths: {
    clips: string
    stats: string
    telemetry: string
    timeline: string
    topology: string
  }
}

export async function runAxisCvProcessor({
  session,
  traceId,
}: {
  session: AxisCvSession
  traceId: string
}): Promise<AxisCvProcessingOutput> {
  const videoUrl = await signedVideoUrl(session)
  const sampledFrames = await extractSampleFrames({
    durationSeconds: Number(session.duration_seconds || 0),
    inputUrl: videoUrl,
  })
  const detectionFrames = await detectFrames(sampledFrames)
  const pipeline = buildReplayTrackingPipeline({
    frames: detectionFrames,
  })
  const timeline = {
    clipWindows: pipeline.timeline.clipWindows,
    events: pipeline.timeline.events,
    possessions: pipeline.timeline.possessions,
    quality: pipeline.quality,
    stats: pipeline.timeline.stats,
    traceId,
  }
  const topology = {
    generatedAt: new Date().toISOString(),
    quality: pipeline.quality,
    source: "roboflow",
    telemetryFrames: pipeline.telemetry.length,
    topology: pipeline.telemetry.map((frame) => ({
      control: frame.control,
      knots: frame.topology.knots,
      pressure: frame.pressure,
      spacing: frame.spacing,
      temporalDensity: frame.topology.temporal_density,
      timestampMs: frame.timestamp_ms,
      windows: frame.topology.windows,
    })),
    traceId,
  }
  const clips = {
    clips: pipeline.timeline.clipWindows.map((windowValue, index) => ({
      id: `clip-${index + 1}`,
      label: labelForReason(windowValue.reason),
      reason: windowValue.reason,
      source: "roboflow",
      startMs: windowValue.startMs,
      endMs: windowValue.endMs,
      status: "planned",
      weight: windowValue.weight,
    })),
    generatedAt: new Date().toISOString(),
    sessionId: session.id,
  }
  const stats = {
    ...pipeline.timeline.stats,
    generatedAt: new Date().toISOString(),
    quality: pipeline.quality,
    sessionId: session.id,
    source: "roboflow",
  }
  const paths = {
    clips: `${session.user_id}/outputs/${session.id}/clips.json`,
    stats: `${session.user_id}/outputs/${session.id}/stats.json`,
    telemetry: `${session.user_id}/outputs/${session.id}/telemetry.ndjson`,
    timeline: `${session.user_id}/outputs/${session.id}/timeline.json`,
    topology: `${session.user_id}/outputs/${session.id}/topology.json`,
  }

  await Promise.all([
    uploadJson(paths.timeline, timeline),
    uploadJson(paths.topology, topology),
    uploadJson(paths.clips, clips),
    uploadJson(paths.stats, stats),
    uploadText(paths.telemetry, pipeline.telemetryNdjson, "application/x-ndjson"),
  ])

  return {
    clips,
    paths,
    quality: pipeline.quality,
    stats,
    telemetryNdjson: pipeline.telemetryNdjson,
    timeline,
    topology,
  }
}

async function signedVideoUrl(session: AxisCvSession) {
  if (!session.file_path) throw new Error("Game video path is missing.")

  const signedUrl = await supabaseAdmin.storage
    .from("axis-replays")
    .createSignedUrl(session.file_path, 60 * 30)

  if (signedUrl.error) throw new Error(signedUrl.error.message)

  return signedUrl.data.signedUrl
}

async function extractSampleFrames({
  durationSeconds,
  inputUrl,
}: {
  durationSeconds: number
  inputUrl: string
}) {
  const id = randomUUID()
  const workDir = path.join(os.tmpdir(), `axis-cv-${id}`)
  const framePattern = path.join(workDir, "frame-%03d.jpg")
  const sampleEverySeconds = durationSeconds > 1800 ? 12 : durationSeconds > 900 ? 8 : 5
  const maxFrames = 36

  try {
    await mkdir(workDir, { recursive: true })
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputUrl)
        .outputOptions([
          `-vf fps=1/${sampleEverySeconds},scale=min(960\\,iw):-2`,
          `-frames:v ${maxFrames}`,
          "-q:v 4",
        ])
        .output(framePattern)
        .on("end", () => resolve())
        .on("error", reject)

      const timeout = setTimeout(() => {
        command.kill("SIGKILL")
        reject(new Error("frame extraction timeout"))
      }, 60000)

      command.on("end", () => clearTimeout(timeout))
      command.on("error", () => clearTimeout(timeout))
      command.run()
    })

    const files = (await readdir(workDir))
      .filter((file) => file.endsWith(".jpg"))
      .sort()

    return Promise.all(
      files.map(async (file, index) => ({
        buffer: await readFile(path.join(workDir, file)),
        frameId: `frame-${index + 1}`,
        timestampMs: index * sampleEverySeconds * 1000,
      }))
    )
  } finally {
    await rm(workDir, { force: true, recursive: true })
  }
}

async function detectFrames(
  frames: Array<{ buffer: Buffer; frameId: string; timestampMs: number }>
): Promise<RawRfDetectionFrame[]> {
  if (!process.env.ROBOFLOW_API_KEY || !process.env.ROBOFLOW_PROJECT || !process.env.ROBOFLOW_VERSION) {
    throw new Error("Roboflow is not configured.")
  }

  const detected: RawRfDetectionFrame[] = []

  for (const frame of frames) {
    const response = await inferRoboflowFrame(frame.buffer)
    detected.push({
      frame_id: frame.frameId,
      height: response.image?.height,
      predictions: normalizePredictions(response.predictions || []),
      timestamp_ms: frame.timestampMs,
      width: response.image?.width,
    })
  }

  if (!detected.length) throw new Error("No frames extracted for CV processing.")

  return detected
}

async function inferRoboflowFrame(buffer: Buffer): Promise<RoboflowResponse> {
  const project = process.env.ROBOFLOW_PROJECT
  const version = process.env.ROBOFLOW_VERSION
  const apiKey = process.env.ROBOFLOW_API_KEY
  const url = new URL(`https://detect.roboflow.com/${project}/${version}`)
  url.searchParams.set("api_key", apiKey || "")
  url.searchParams.set("confidence", process.env.ROBOFLOW_CONFIDENCE || "30")
  url.searchParams.set("overlap", process.env.ROBOFLOW_OVERLAP || "30")
  url.searchParams.set("format", "json")

  const response = await fetch(url, {
    body: buffer.toString("base64"),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(`Roboflow inference failed: ${response.status}`)
  }

  return (await response.json()) as RoboflowResponse
}

function normalizePredictions(predictions: RoboflowPrediction[]): RawRfDetection[] {
  return predictions.map((prediction, index) => ({
    class: prediction.class ?? prediction.class_name,
    classId: prediction.class_id,
    confidence: prediction.confidence,
    height: prediction.height,
    id: index,
    width: prediction.width,
    x:
      typeof prediction.x === "number" && typeof prediction.width === "number"
        ? prediction.x - prediction.width / 2
        : prediction.x,
    y:
      typeof prediction.y === "number" && typeof prediction.height === "number"
        ? prediction.y - prediction.height / 2
        : prediction.y,
  }))
}

async function uploadJson(pathValue: string, payload: unknown) {
  return uploadText(pathValue, JSON.stringify(payload, null, 2), "application/json")
}

async function uploadText(pathValue: string, body: string, contentType: string) {
  const upload = await supabaseAdmin.storage
    .from("axis-replays")
    .upload(pathValue, body, {
      cacheControl: "3600",
      contentType,
      upsert: true,
    })

  if (upload.error) throw new Error(upload.error.message)
}

function labelForReason(reason: string) {
  if (reason === "shot_attempt") return "Shot attempt"
  if (reason === "turnover") return "Turnover"
  if (reason === "pressure_spike") return "Pressure"
  if (reason === "transition") return "Transition"
  if (reason === "collapse_window") return "Collapse"
  if (reason === "topology_knot") return "Replay knot"
  return "Game moment"
}
