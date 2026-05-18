"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Upload } from "lucide-react"
import ModeNav from "@/components/ModeNav"
import {
  extractReplayLandmarks,
  type CandidateReplayLandmark,
} from "@/lib/axis-ai/extractReplayLandmarks"
import {
  parseUploadResponseText,
  type AxisUploadResponse,
} from "@/lib/uploadResponse"

type ReplayMoment = {
  id: string
  sessionId: string
  title: string
  caption: string
  detail: string
  timestamp: string
  timestampSeconds?: number
  videoUrl?: string | null
  keyframeUrl?: string | null
  sessionTitle: string
}

type RecentSession = {
  id: string
  title: string
  time: string
  videoUrl?: string | null
  captions: string[]
}

type PlayerMoment = {
  name: string
  phrase: string
  count: number
}

type Props = {
  replayMoments: ReplayMoment[]
  recentSessions: RecentSession[]
  playerMoments: PlayerMoment[]
}

const waveformBars = [42, 72, 48, 86, 56, 64, 94, 44, 78, 52, 88, 60, 46, 82]

function uploadStatus(data: AxisUploadResponse) {
  if (data.ok) return "Saved. Memory is processing."
  if (data.error) return data.error.toLowerCase()

  return "Upload failed"
}

function safeParseUploadResponse(text: string) {
  try {
    return parseUploadResponseText(text)
  } catch {
    return {
      ok: false,
      error: "Upload response unreadable",
    } satisfies AxisUploadResponse
  }
}

function uploadWithProgress({
  formData,
  onProgress,
}: {
  formData: FormData
  onProgress: (progress: number) => void
}) {
  return new Promise<AxisUploadResponse>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.open("POST", "/api/upload")
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return

      onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      const result = safeParseUploadResponse(request.responseText)

      if (request.status >= 200 && request.status < 300 && result.ok) {
        onProgress(100)
        resolve(result)
      } else {
        reject(
          new Error(result.detail || result.error || `Upload ${request.status}`)
        )
      }
    }
    request.onerror = () => reject(new Error("Network interrupted"))
    request.onabort = () => reject(new Error("Upload cancelled"))
    request.send(formData)
  })
}

function readVideoMetadata(file: File) {
  return new Promise<{ duration: number; url: string }>((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")

    video.preload = "metadata"
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0

      resolve({
        duration,
        url,
      })
    }
    video.onerror = () => {
      resolve({
        duration: 0,
        url,
      })
    }
    video.src = url
  })
}

function seekVideo(video: HTMLVideoElement, seconds: number) {
  return new Promise<void>((resolve) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const safeSeconds = duration
      ? Math.min(Math.max(0, seconds), Math.max(0, duration - 0.2))
      : Math.max(0, seconds)
    const timeout = window.setTimeout(() => {
      video.removeEventListener("seeked", cleanup)
      resolve()
    }, 1200)
    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener("seeked", cleanup)
      resolve()
    }

    video.addEventListener("seeked", cleanup)
    video.currentTime = safeSeconds
  })
}

async function captureKeyframes({
  videoUrl,
  landmarks,
  onFrame,
}: {
  videoUrl: string
  landmarks: CandidateReplayLandmark[]
  onFrame?: (frame: {
    landmark: CandidateReplayLandmark
    keyframeUrl: string | null
  }) => void
}) {
  const video = document.createElement("video")
  video.crossOrigin = "anonymous"
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.src = videoUrl

  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => resolve()
  })

  const canvas = document.createElement("canvas")
  const width = 420
  const height = 236
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")

  if (!context) {
    const frames = landmarks.map((landmark) => ({
      landmark,
      keyframeUrl: null,
    }))

    frames.forEach((frame) => onFrame?.(frame))

    return frames
  }

  const frames: {
    landmark: CandidateReplayLandmark
    keyframeUrl: string | null
  }[] = []

  for (const landmark of landmarks) {
    await seekVideo(video, landmark.timestampSeconds)
    context.fillStyle = "#090806"
    context.fillRect(0, 0, width, height)
    context.drawImage(video, 0, 0, width, height)
    frames.push({
      landmark,
      keyframeUrl: canvas.toDataURL("image/jpeg", 0.72),
    })
    onFrame?.(frames[frames.length - 1])
  }

  return frames
}

function momentFromFrame({
  landmark,
  keyframeUrl,
  videoUrl,
  fileName,
}: {
  landmark: CandidateReplayLandmark
  keyframeUrl: string | null
  videoUrl: string
  fileName: string
}): ReplayMoment {
  return {
    id: `local-${landmark.id}`,
    sessionId: "local-upload",
    title: landmark.title,
    caption: landmark.caption,
    detail: landmark.detail,
    timestamp: landmark.timestamp,
    timestampSeconds: landmark.timestampSeconds,
    videoUrl,
    keyframeUrl,
    sessionTitle: fileName,
  }
}

export default function UploadMemoryConsole({
  replayMoments,
  recentSessions,
  playerMoments,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const localVideoUrlRef = useRef<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState("")
  const [processingLine, setProcessingLine] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [transcriptLines, setTranscriptLines] = useState<string[]>([])
  const [selectedMoment, setSelectedMoment] = useState<
    ReplayMoment | undefined
  >(replayMoments[0])
  const [localMoments, setLocalMoments] = useState<ReplayMoment[]>([])

  useEffect(() => {
    const video = previewRef.current

    if (!video || typeof selectedMoment?.timestampSeconds !== "number") return

    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const safeSeconds = duration
      ? Math.min(
          Math.max(0, selectedMoment.timestampSeconds),
          Math.max(0, duration - 0.2)
        )
      : Math.max(0, selectedMoment.timestampSeconds)

    video.currentTime = safeSeconds
    void video.play().catch(() => undefined)
  }, [selectedMoment])

  useEffect(
    () => () => {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }
    },
    []
  )

  async function chooseFile(file: File | undefined) {
    if (!file || isUploading) return

    setIsUploading(true)
    setStatus("Extracting keyframes")
    setProcessingLine("Reading the footage")
    setUploadProgress(0)
    setTranscriptLines([])
    let extractedMoments = false

    try {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }

      const metadata = await readVideoMetadata(file)
      localVideoUrlRef.current = metadata.url
      const landmarks = extractReplayLandmarks({
        durationSeconds: metadata.duration,
      })
      setLocalMoments([])
      setSelectedMoment(undefined)
      setProcessingLine("Finding memory anchors")

      await captureKeyframes({
        videoUrl: metadata.url,
        landmarks,
        onFrame: ({ landmark, keyframeUrl }) => {
          const moment = momentFromFrame({
            landmark,
            keyframeUrl,
            videoUrl: metadata.url,
            fileName: file.name,
          })

          setLocalMoments((items) => {
            if (items.some((item) => item.id === moment.id)) return items

            return [...items, moment]
          })
          setSelectedMoment((current) => current || moment)
          setProcessingLine(`${landmark.caption} / ${landmark.timestamp}`)
          setTranscriptLines((lines) =>
            [
              ...lines,
              `[${landmark.timestamp}] ${landmark.title}`,
            ].slice(-5)
          )
        },
      })

      setStatus("Keyframes ready")
      setProcessingLine("Memory stream ready")
      extractedMoments = true

      const formData = new FormData()
      formData.append("file", file)
      formData.append("source", "upload")
      formData.append("environment", "practice")
      formData.append("mission", "Replay memory")
      formData.append("player", "Unassigned")
      formData.append("duration", String(metadata.duration))

      setStatus("Uploading video")
      setProcessingLine("Saving replay memory")

      let result: AxisUploadResponse

      try {
        result = await uploadWithProgress({
          formData,
          onProgress: setUploadProgress,
        })
      } catch (error) {
        console.warn("UPLOAD RETRY", error)
        setStatus("Connection paused. Retrying.")
        setProcessingLine("Keeping keyframes ready")
        setUploadProgress(0)
        result = await uploadWithProgress({
          formData,
          onProgress: setUploadProgress,
        })
      }

      setStatus(uploadStatus(result))
      setProcessingLine(result.ok ? "Saved to Axis" : "Upload needs another try")
    } catch (error) {
      console.error("UPLOAD MEMORY FAILED", error)
      setStatus("Upload failed")
      setProcessingLine(
        extractedMoments
          ? "Keyframes stayed ready. Try upload again."
          : "Could not extract this video"
      )
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const visibleMoments = localMoments.length ? localMoments : replayMoments
  const activeMoment = selectedMoment || visibleMoments[0]

  return (
    <main className="min-h-screen bg-[#0a0907] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <ModeNav active="record" />
        </header>

        <section
          id="upload"
          className="grid min-h-[78vh] gap-10 py-8 lg:grid-cols-[1fr_420px] lg:items-center"
        >
          <div>
            <p className="text-sm font-bold text-white/38">Upload first</p>
            <h1 className="mt-4 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.065em] text-white sm:text-8xl">
              Find the moments.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/48">
              Choose messy basketball footage. Axis pulls out keyframes,
              timestamps, and coachable replay anchors before the film gets
              hard to navigate.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-3 rounded-full bg-stone-100 px-8 py-5 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-amber-100 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {isUploading ? "Uploading" : "Choose file"}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="video/*,.mov,.mp4,.m4v"
                capture="environment"
                className="hidden"
                onChange={(event) => void chooseFile(event.target.files?.[0])}
              />
              {status ? (
                <p className="text-sm font-bold text-white/42">{status}</p>
              ) : null}
            </div>
            {processingLine ? (
              <p className="mt-5 text-2xl font-black tracking-[-0.04em] text-amber-100/80">
                {processingLine}
              </p>
            ) : null}
            {isUploading || uploadProgress > 0 ? (
              <div className="mt-5 max-w-sm">
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-100 transition-all duration-500"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-white/35">
                  {uploadProgress
                    ? `${uploadProgress}% uploaded`
                    : "Keyframes appear before the upload finishes"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[1.5rem] bg-[#16120d] shadow-[0_42px_140px_rgba(0,0,0,0.55)]">
            <div className="aspect-[9/14] bg-black">
              {activeMoment?.videoUrl ? (
                <video
                  ref={previewRef}
                  src={activeMoment.videoUrl}
                  className="h-full w-full object-cover opacity-80"
                  muted
                  playsInline
                  loop
                  preload="metadata"
                />
              ) : (
                <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,#2a2117_0%,#090806_68%)] px-8 text-center">
                  <p className="text-4xl font-black leading-none tracking-[-0.05em] text-white">
                    Replay memory appears here.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-amber-100/65">
                {activeMoment?.timestamp || "0:00"}
              </p>
              <p className="mt-3 text-4xl font-black leading-[0.95] tracking-[-0.05em] text-white">
                {activeMoment?.caption || "CHOOSE FILE"}
              </p>
              <p className="mt-4 text-sm leading-6 text-white/42">
                {activeMoment?.detail ||
                    "Keyframes mark where to start watching."}
              </p>
              <div className="mt-6 flex h-12 items-end gap-1">
                {waveformBars.map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className={`w-full rounded-full transition ${
                      isUploading && index % 3 === 0
                        ? "bg-amber-100/70"
                        : "bg-white/16"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              {transcriptLines.length ? (
                <div className="mt-5 grid gap-2">
                  {transcriptLines.slice(-3).map((line) => (
                    <p
                      key={line}
                      className="text-sm font-bold uppercase tracking-[0.08em] text-white/34"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {visibleMoments.length ? (
          <section className="pb-10">
            <div className="flex gap-3 overflow-x-auto pb-3">
              {visibleMoments.slice(0, 8).map((moment) => {
                const active = activeMoment?.id === moment.id

                return (
                  <button
                    key={`rail-${moment.id}`}
                    type="button"
                    onClick={() => setSelectedMoment(moment)}
                    className={`min-w-44 overflow-hidden rounded-xl text-left transition ${
                      active
                        ? "bg-stone-100 text-black"
                        : "bg-white/[0.045] text-white/70 hover:bg-white/[0.075] hover:text-white"
                    }`}
                  >
                    <div className="h-24 bg-black">
                      {moment.keyframeUrl ? (
                        <div
                          className="h-full w-full bg-cover bg-center opacity-80"
                          style={{
                            backgroundImage: `url(${moment.keyframeUrl})`,
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-black">{moment.timestamp}</p>
                      <p className="mt-1 text-sm font-black leading-tight">
                        {moment.caption}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="grid gap-12 border-t border-white/8 py-12">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-bold text-white/38">Replay anchors</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                The meaningful parts rise up.
              </h2>
            </div>
            <Link
              href="/sessions"
              className="w-fit text-sm font-bold text-white/42 transition hover:text-white"
            >
              Sessions
            </Link>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleMoments.slice(0, 6).map((moment) => (
                <button
                  key={moment.id}
                  type="button"
                  onClick={() => setSelectedMoment(moment)}
                  className="group overflow-hidden rounded-xl bg-white/[0.035] text-left transition hover:bg-white/[0.06]"
                >
                  <div className="aspect-video bg-black">
                    {moment.keyframeUrl ? (
                      <div
                        className="h-full w-full bg-cover bg-center opacity-80 transition group-hover:opacity-95"
                        style={{
                          backgroundImage: `url(${moment.keyframeUrl})`,
                        }}
                        aria-hidden="true"
                      />
                    ) : moment.videoUrl ? (
                      <video
                        src={moment.videoUrl}
                        className="h-full w-full object-cover opacity-70 transition group-hover:opacity-90"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <p className="text-sm font-bold text-amber-100/65">
                      {moment.timestamp}
                    </p>
                    <p className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em] text-white">
                      {moment.caption}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-white/38">
                      {moment.sessionTitle}
                    </p>
                  </div>
                </button>
              ))}
              {visibleMoments.length === 0 ? (
                <div className="py-16">
                  <p className="max-w-xl text-3xl font-black tracking-[-0.04em] text-white">
                    Choose a video. The first replay anchors will appear here.
                  </p>
                </div>
              ) : null}
            </div>

            <aside className="grid h-fit gap-9">
              <section>
                <h3 className="text-sm font-bold text-white/38">
                  Resurfaced sessions
                </h3>
                <div className="mt-4 grid gap-4">
                  {recentSessions.slice(0, 5).map((session) => (
                    <Link
                      key={session.id}
                      href={`/replay/${session.id}`}
                      className="block rounded-xl bg-white/[0.035] p-4 transition hover:bg-white/[0.06]"
                    >
                      <p className="text-lg font-black text-white">
                        {session.title}
                      </p>
                      <p className="mt-1 text-sm text-white/35">{session.time}</p>
                      {session.captions[0] ? (
                        <p className="mt-4 text-sm font-black text-white/72">
                          {session.captions[0]}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-white/38">
                  Player mentions
                </h3>
                <div className="mt-4 grid gap-4">
                  {playerMoments.slice(0, 5).map((player) => (
                    <Link
                      key={player.name}
                      href={`/players?player=${encodeURIComponent(player.name)}`}
                      className="transition hover:text-amber-100"
                    >
                      <p className="text-lg font-black text-white">
                        {player.name}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/42">
                        {player.phrase}
                      </p>
                    </Link>
                  ))}
                  {playerMoments.length === 0 ? (
                    <p className="text-sm leading-6 text-white/42">
                      Player moments appear when names show up in captions or notes.
                    </p>
                  ) : null}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
