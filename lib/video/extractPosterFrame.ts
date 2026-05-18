import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import { randomUUID } from "crypto"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"

ffmpeg.setFfmpegPath(ffmpegPath as string)

export type PosterExtractionResult = {
  ok: boolean
  buffer?: Buffer
  attemptedAtSeconds: number[]
  error?: string
}

function runPosterExtraction({
  inputPath,
  outputPath,
  timestampSeconds,
  timeoutMs,
}: {
  inputPath: string
  outputPath: string
  timestampSeconds: number
  timeoutMs: number
}) {
  return new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .seekInput(timestampSeconds)
      .outputOptions([
        "-frames:v 1",
        "-vf scale=min(540\\,iw):-2",
        "-q:v 4",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)

    const timeout = setTimeout(() => {
      command.kill("SIGKILL")
      reject(new Error("poster extraction timeout"))
    }, timeoutMs)

    command.on("end", () => clearTimeout(timeout))
    command.on("error", () => clearTimeout(timeout))
    command.run()
  })
}

export async function extractPosterFrame({
  buffer,
  extension,
  durationSeconds,
  timeoutMs = 9000,
}: {
  buffer: Buffer
  extension: string
  durationSeconds: number
  timeoutMs?: number
}): Promise<PosterExtractionResult> {
  const id = randomUUID()
  const workDir = path.join(os.tmpdir(), `axis-poster-${id}`)
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "") || "mov"
  const inputPath = path.join(workDir, `input.${safeExtension}`)
  const outputPath = path.join(workDir, "poster.jpg")
  const duration = Number.isFinite(durationSeconds) ? durationSeconds : 0
  const timestamps = [
    duration > 8 ? 2 : 0.2,
    duration > 16 ? Math.min(6, Math.floor(duration / 3)) : 1,
    0,
  ].filter((value, index, items) => value >= 0 && items.indexOf(value) === index)
  const attemptedAtSeconds: number[] = []
  let lastError = ""

  try {
    await mkdir(workDir, { recursive: true })
    await writeFile(inputPath, buffer)

    for (const timestampSeconds of timestamps) {
      attemptedAtSeconds.push(timestampSeconds)

      try {
        await runPosterExtraction({
          inputPath,
          outputPath,
          timestampSeconds,
          timeoutMs,
        })

        return {
          ok: true,
          buffer: await readFile(outputPath),
          attemptedAtSeconds,
        }
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "poster extraction failed"
      }
    }

    return {
      ok: false,
      attemptedAtSeconds,
      error: lastError || "poster extraction failed",
    }
  } finally {
    await rm(workDir, {
      force: true,
      recursive: true,
    })
  }
}
