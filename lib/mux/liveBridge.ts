import { spawn, type ChildProcessByStdio } from "node:child_process"
import type { Readable, Writable } from "node:stream"
import ffmpegPath from "ffmpeg-static"

type BridgeProcess = ChildProcessByStdio<Writable, null, Readable>

type BridgeSession = {
  id: string
  streamKey: string
  process: BridgeProcess
  startedAt: number
  lastChunkAt: number
  status: "connecting" | "live" | "reconnecting" | "ended"
  error?: string
}

const ingestUrl = "rtmp://global-live.mux.com:5222/app"

declare global {
  var __axisLiveBridgeSessions: Map<string, BridgeSession> | undefined
}

const sessions = globalThis.__axisLiveBridgeSessions ?? new Map<string, BridgeSession>()
globalThis.__axisLiveBridgeSessions = sessions

function createSessionId() {
  return `axis-live-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function startFfmpeg(streamKey: string) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg unavailable")
  }

  return spawn(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "+genpts",
      "-use_wallclock_as_timestamps",
      "1",
      "-i",
      "pipe:0",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-tune",
      "zerolatency",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-g",
      "60",
      "-b:v",
      "2500k",
      "-maxrate",
      "2500k",
      "-bufsize",
      "5000k",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      "-f",
      "flv",
      `${ingestUrl}/${streamKey}`,
    ],
    {
      stdio: ["pipe", "ignore", "pipe"],
    }
  )
}

export function createLiveBridgeSession(streamKey: string) {
  const id = createSessionId()
  const process = startFfmpeg(streamKey)
  const session: BridgeSession = {
    id,
    streamKey,
    process,
    startedAt: Date.now(),
    lastChunkAt: Date.now(),
    status: "connecting",
  }

  process.stderr.on("data", () => {
    session.error = "Mux ingest reconnecting"
    session.status = session.status === "ended" ? "ended" : "reconnecting"
  })
  process.on("exit", () => {
    session.status = "ended"
    sessions.delete(id)
  })
  process.stdin.on("error", () => {
    session.error = "Mux ingest interrupted"
    session.status = session.status === "ended" ? "ended" : "reconnecting"
  })

  sessions.set(id, session)

  return {
    id,
    status: session.status,
  }
}

export function writeLiveBridgeChunk(sessionId: string, chunk: Buffer) {
  const session = sessions.get(sessionId)

  if (!session || session.status === "ended") {
    return {
      ok: false,
      status: "reconnecting" as const,
    }
  }

  if (!chunk.length || session.process.stdin.destroyed) {
    session.status = "reconnecting"

    return {
      ok: false,
      status: session.status,
    }
  }

  session.lastChunkAt = Date.now()
  session.status = "live"
  session.process.stdin.write(chunk, (error) => {
    if (error) {
      session.error = "Mux ingest interrupted"
      session.status = "reconnecting"
    }
  })

  return {
    ok: true,
    status: session.status,
  }
}

export function stopLiveBridgeSession(sessionId: string) {
  const session = sessions.get(sessionId)

  if (!session) return

  session.status = "ended"
  sessions.delete(sessionId)
  if (!session.process.stdin.destroyed) {
    session.process.stdin.end()
  }
  if (!session.process.killed) {
    session.process.kill("SIGTERM")
  }
}
