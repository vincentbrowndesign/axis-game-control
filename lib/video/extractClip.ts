import { randomUUID } from "crypto"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import { mkdir, readFile, rm } from "fs/promises"
import os from "os"
import path from "path"

ffmpeg.setFfmpegPath(ffmpegPath as string)

export type ClipExtractionResult = {
  buffer?: Buffer
  durationSeconds: number
  error?: string
  ok: boolean
}

export async function extractClip({
  durationMs,
  inputUrl,
  startMs,
  timeoutMs = 45000,
}: {
  durationMs: number
  inputUrl: string
  startMs: number
  timeoutMs?: number
}): Promise<ClipExtractionResult> {
  const id = randomUUID()
  const workDir = path.join(os.tmpdir(), `axis-clip-${id}`)
  const outputPath = path.join(workDir, "clip.mp4")
  const startSeconds = Math.max(0, startMs / 1000)
  const durationSeconds = Math.max(0.5, durationMs / 1000)

  try {
    await mkdir(workDir, { recursive: true })

    try {
      await runClipExtraction({
        copy: true,
        durationSeconds,
        inputUrl,
        outputPath,
        startSeconds,
        timeoutMs,
      })
    } catch {
      await runClipExtraction({
        copy: false,
        durationSeconds,
        inputUrl,
        outputPath,
        startSeconds,
        timeoutMs,
      })
    }

    return {
      buffer: await readFile(outputPath),
      durationSeconds,
      ok: true,
    }
  } catch (error) {
    return {
      durationSeconds,
      error: error instanceof Error ? error.message : "clip extraction failed",
      ok: false,
    }
  } finally {
    await rm(workDir, {
      force: true,
      recursive: true,
    })
  }
}

function runClipExtraction({
  copy,
  durationSeconds,
  inputUrl,
  outputPath,
  startSeconds,
  timeoutMs,
}: {
  copy: boolean
  durationSeconds: number
  inputUrl: string
  outputPath: string
  startSeconds: number
  timeoutMs: number
}) {
  return new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputUrl)
      .inputOptions([`-ss ${startSeconds.toFixed(3)}`])
      .outputOptions(
        copy
          ? [
              `-t ${durationSeconds.toFixed(3)}`,
              "-c copy",
              "-avoid_negative_ts make_zero",
              "-movflags +faststart",
            ]
          : [
              `-t ${durationSeconds.toFixed(3)}`,
              "-c:v libx264",
              "-preset veryfast",
              "-crf 24",
              "-c:a aac",
              "-b:a 128k",
              "-movflags +faststart",
            ]
      )
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)

    const timeout = setTimeout(() => {
      command.kill("SIGKILL")
      reject(new Error("clip extraction timeout"))
    }, timeoutMs)

    command.on("end", () => clearTimeout(timeout))
    command.on("error", () => clearTimeout(timeout))
    command.run()
  })
}
