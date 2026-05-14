import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import fs from "fs"
import path from "path"

ffmpeg.setFfmpegPath(ffmpegPath as string)

export async function extractFrames(
  inputPath: string,
  outputDir: string
) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(path.join(outputDir, "frame-%03d.jpg"))
      .outputOptions([
        "-vf fps=1"
      ])
      .on("end", () => resolve(true))
      .on("error", reject)
      .run()
  })
}