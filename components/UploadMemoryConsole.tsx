"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, Video } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  parseUploadResponseText,
  type AxisUploadResponse,
} from "@/lib/uploadResponse"

const waveformBars = [42, 72, 48, 86, 56, 64, 94, 44, 78, 52, 88, 60, 46, 82]
const showDebug = process.env.NODE_ENV !== "production"
type UploadSource = "camera" | "upload"

type ClientUploadInfo = {
  traceId: string
  uploadFile: File | Blob
  uploadName: string
  uploadType: string
  isMobile: boolean
  isIOS: boolean
  isSafari: boolean
  userAgent: string
  viewport: string
}

function uploadStatus(data: AxisUploadResponse) {
  if (data.ok) return "Playback ready."
  if (data.recovery) return "Playback ready."
  if (data.stored) return "Playback ready."
  if (data.error) return "Still processing..."

  return "Still processing..."
}

function safeStorageName(name: string) {
  const cleanName = name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60)
  const extension = name.includes(".")
    ? name.split(".").pop()?.toLowerCase() || "mov"
    : "mov"

  return `${Date.now()}_${cleanName || "axis_upload"}.${extension}`
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

async function completeUpload({
  traceId,
  filePath,
  fileName,
  contentType,
  sizeBytes,
  durationSeconds,
  source,
  client,
}: {
  traceId: string
  filePath: string
  fileName: string
  contentType: string
  sizeBytes: number
  durationSeconds: number
  source: UploadSource
  client: Record<string, unknown>
}) {
  const response = await fetch("/api/upload/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      traceId,
      filePath,
      fileName,
      contentType,
      sizeBytes,
      durationSeconds,
      source,
      environment: "practice",
      mission: "Replay memory",
      player: "Unassigned",
      client,
    }),
  })
  const text = await response.text()
  const result = safeParseUploadResponse(text)

  if (!response.ok && !result.ok) {
    throw new Error(result.detail || result.error || `Complete ${response.status}`)
  }

  return result
}

function mobileUploadInfo(file: File): ClientUploadInfo {
  const userAgent = navigator.userAgent || ""
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
  const isMobile =
    isIOS ||
    /Android|Mobi|Mobile/i.test(userAgent) ||
    window.matchMedia("(pointer: coarse)").matches
  const inferredType = file.type || (
    file.name.toLowerCase().endsWith(".mov")
      ? "video/quicktime"
      : file.name.toLowerCase().endsWith(".m4v")
        ? "video/x-m4v"
        : "video/mp4"
  )
  const uploadName = file.name || `axis-mobile-${Date.now()}.mov`
  let uploadFile: File | Blob = file

  try {
    uploadFile = new File([file], uploadName, {
      type: inferredType,
      lastModified: file.lastModified || Date.now(),
    })
  } catch {
    uploadFile = new Blob([file], {
      type: inferredType,
    })
  }

  return {
    traceId: crypto.randomUUID(),
    uploadFile,
    uploadName,
    uploadType: inferredType,
    isMobile,
    isIOS,
    isSafari,
    userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  }
}

function readVideoMetadata(url: string) {
  return new Promise<{ duration: number; url: string }>((resolve) => {
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

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** index

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export default function UploadMemoryConsole() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const recordInputRef = useRef<HTMLInputElement | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const localVideoUrlRef = useRef<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState("")
  const [processingLine, setProcessingLine] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [debugTraceId, setDebugTraceId] = useState("")
  const [playbackUrl, setPlaybackUrl] = useState("")
  const [playbackTitle, setPlaybackTitle] = useState("")
  const [durationLabel, setDurationLabel] = useState("0:00")
  const [fileSizeLabel, setFileSizeLabel] = useState("")
  const [createdLabel, setCreatedLabel] = useState("")
  const [debugLines, setDebugLines] = useState<string[]>([])

  function addDebug(line: string) {
    if (!showDebug) return

    setDebugLines((lines) => [...lines, line].slice(-12))
  }

  useEffect(
    () => () => {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }
    },
    []
  )

  async function chooseFile(file: File | undefined, source: UploadSource = "upload") {
    if (!file || isUploading) return

    setIsUploading(true)
    setStatus("Preparing playback")
    setProcessingLine("Reading the footage")
    setUploadProgress(0)
    setDebugTraceId("")
    setDebugLines([])
    setFileSizeLabel("")
    setCreatedLabel("")
    const uploadInfo = mobileUploadInfo(file)
    setDebugTraceId(uploadInfo.traceId)
    addDebug(`source: ${source}`)
    addDebug(`file selected: ${file.name || uploadInfo.uploadName}`)
    addDebug(`file type: ${file.type || uploadInfo.uploadType}`)
    addDebug(`file size: ${formatBytes(file.size)}`)

    console.info("AXIS MOBILE UPLOAD", {
      traceId: uploadInfo.traceId,
      stage: "upload-start",
      file: {
        name: file.name,
        type: file.type || "missing",
        size: file.size,
        lastModified: file.lastModified,
      },
      mobile: {
        isMobile: uploadInfo.isMobile,
        isIOS: uploadInfo.isIOS,
        isSafari: uploadInfo.isSafari,
        viewport: uploadInfo.viewport,
      },
    })

    try {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }

      const localUrl = URL.createObjectURL(file)
      localVideoUrlRef.current = localUrl
      setPlaybackUrl(localUrl)
      setPlaybackTitle(file.name || "Basketball footage")
      setFileSizeLabel(formatBytes(file.size))
      setStatus("Playback ready. Saving video.")
      setProcessingLine("Your footage is safe here first.")
      void previewRef.current?.play().catch(() => undefined)

      const metadata = await readVideoMetadata(localUrl)
      const safeDuration = Math.max(0, Math.floor(metadata.duration))
      const minutes = Math.floor(safeDuration / 60)
      const seconds = safeDuration % 60
      setDurationLabel(`${minutes}:${seconds.toString().padStart(2, "0")}`)
      localVideoUrlRef.current = metadata.url

      setStatus("Uploading video")
      setProcessingLine("Saving directly to playback storage.")
      setUploadProgress(12)
      addDebug("upload started")

      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(userError?.message || "Sign in required")
      }

      const filePath = `${user.id}/${safeStorageName(uploadInfo.uploadName)}`
      addDebug(`storage path: ${filePath}`)
      const clientDebug = {
        clientTraceId: uploadInfo.traceId,
        clientName: file.name || uploadInfo.uploadName,
        clientType: file.type || uploadInfo.uploadType,
        clientSize: file.size,
        clientLastModified: file.lastModified || 0,
        clientUserAgent: uploadInfo.userAgent,
        clientIsMobile: uploadInfo.isMobile,
        clientIsIOS: uploadInfo.isIOS,
        clientIsSafari: uploadInfo.isSafari,
        clientViewport: uploadInfo.viewport,
      }

      try {
        const uploaded = await supabase.storage
          .from("axis-replays")
          .upload(filePath, uploadInfo.uploadFile, {
            contentType: uploadInfo.uploadType,
            upsert: false,
          })

        if (uploaded.error) {
          addDebug(`storage failure: ${uploaded.error.message}`)
          throw uploaded.error
        }

        addDebug("storage success")
        setUploadProgress(78)
        setProcessingLine("Playback copy saved. Opening it now.")

        const signed = await supabase.storage
          .from("axis-replays")
          .createSignedUrl(filePath, 60 * 60 * 24 * 7)

        if (!signed.error && signed.data?.signedUrl) {
          setPlaybackUrl(signed.data.signedUrl)
          addDebug("playback URL created")
        }

        const result = await completeUpload({
          traceId: uploadInfo.traceId,
          filePath,
          fileName: uploadInfo.uploadName,
          contentType: uploadInfo.uploadType,
          sizeBytes: file.size,
          durationSeconds: metadata.duration,
          source,
          client: clientDebug,
        })

        setUploadProgress(100)
        setStatus(uploadStatus(result))
        if (result.videoUrl) {
          setPlaybackUrl(result.videoUrl)
        }
        setCreatedLabel(new Date(result.createdAt || Date.now()).toLocaleString())
        addDebug(
          result.replayId
            ? `database insert success: ${result.replayId}`
            : "database insert deferred"
        )
        setProcessingLine("Playback ready.")
      } catch (error) {
        addDebug(
          `storage failure: ${error instanceof Error ? error.message : "unknown"}`
        )
        console.warn("AXIS DIRECT UPLOAD RETRY", {
          traceId: uploadInfo.traceId,
          error,
        })
        setStatus("Still processing...")
        setProcessingLine("Connection paused. Retrying quietly.")
        setUploadProgress(18)
        await new Promise((resolve) => window.setTimeout(resolve, 900))

        const retryPath = `${user.id}/${safeStorageName(uploadInfo.uploadName)}`
        const retry = await supabase.storage
          .from("axis-replays")
          .upload(retryPath, uploadInfo.uploadFile, {
            contentType: uploadInfo.uploadType,
            upsert: false,
          })

        if (retry.error) {
          addDebug(`storage failure: ${retry.error.message}`)
          throw retry.error
        }

        addDebug("storage success")
        setUploadProgress(82)
        const signed = await supabase.storage
          .from("axis-replays")
          .createSignedUrl(retryPath, 60 * 60 * 24 * 7)

        if (!signed.error && signed.data?.signedUrl) {
          setPlaybackUrl(signed.data.signedUrl)
          addDebug("playback URL created")
        }

        const result = await completeUpload({
          traceId: uploadInfo.traceId,
          filePath: retryPath,
          fileName: uploadInfo.uploadName,
          contentType: uploadInfo.uploadType,
          sizeBytes: file.size,
          durationSeconds: metadata.duration,
          source,
          client: {
            ...clientDebug,
            retry: true,
          },
        })

        setUploadProgress(100)
        setStatus(uploadStatus(result))
        if (result.videoUrl) {
          setPlaybackUrl(result.videoUrl)
        }
        setCreatedLabel(new Date(result.createdAt || Date.now()).toLocaleString())
        addDebug(
          result.replayId
            ? `database insert success: ${result.replayId}`
            : "database insert deferred"
        )
        setProcessingLine("Playback ready.")
      }
    } catch (error) {
      console.error("UPLOAD MEMORY FAILED", error)
      addDebug(
        `database insert failure: ${
          error instanceof Error ? error.message : "unknown"
        }`
      )
      setStatus("Still processing...")
      setProcessingLine("Playback stays here. Axis will keep trying.")
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ""
      if (recordInputRef.current) recordInputRef.current.value = ""
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0907] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <span className="text-sm font-black text-white/85">
            Axis
          </span>
        </header>

        <section
          id="upload"
          className="grid min-h-[78vh] gap-10 py-8 lg:grid-cols-[1fr_420px] lg:items-center"
        >
          <div>
            <p className="text-sm font-bold text-white/38">Basketball camera</p>
            <h1 className="mt-4 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.065em] text-white sm:text-8xl">
              Capture. Save. Play.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/48">
              Record the play or choose existing footage. Playback appears
              first, then Axis saves it quietly.
            </p>

            <div className="mt-9 grid gap-3 sm:max-w-md">
              <button
                type="button"
                onClick={() => recordInputRef.current?.click()}
                disabled={isUploading}
                className="order-1 inline-flex min-h-24 items-center justify-center gap-3 rounded-[0.75rem] bg-amber-200 px-8 py-5 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-amber-100 disabled:opacity-50 sm:order-2"
              >
                <Video className="h-4 w-4" aria-hidden="true" />
                Record play
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploading}
                className="order-2 inline-flex min-h-24 items-center justify-center gap-3 rounded-[0.75rem] bg-stone-100 px-8 py-5 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-white disabled:opacity-50 sm:order-1"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {isUploading ? "Uploading" : "Upload clip"}
              </button>
              <input
                ref={recordInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={(event) => void chooseFile(event.target.files?.[0], "camera")}
              />
              <input
                ref={uploadInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => void chooseFile(event.target.files?.[0], "upload")}
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
                    : "Playback appears as soon as the video is ready"}
                </p>
                {debugTraceId ? (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/20">
                    trace {debugTraceId.slice(0, 8)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[1.5rem] bg-[#16120d] shadow-[0_42px_140px_rgba(0,0,0,0.55)]">
            <div className="aspect-[9/14] bg-black">
              {playbackUrl ? (
                <video
                  ref={previewRef}
                  src={playbackUrl}
                  className="h-full w-full object-cover opacity-80"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,#2a2117_0%,#090806_68%)] px-8 text-center">
                  <p className="text-4xl font-black leading-none tracking-[-0.05em] text-white">
                    Playback appears here.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-amber-100/65">
                {durationLabel}
              </p>
              <p className="mt-3 text-4xl font-black leading-[0.95] tracking-[-0.05em] text-white">
                {playbackUrl ? "PLAYBACK READY" : "READY"}
              </p>
              <p className="mt-4 text-sm leading-6 text-white/42">
                {playbackTitle || "The saved video becomes watchable first."}
              </p>
              <div className="mt-5 grid gap-2 text-sm text-white/38">
                {fileSizeLabel ? <p>Size: {fileSizeLabel}</p> : null}
                {createdLabel ? <p>Saved: {createdLabel}</p> : null}
                {playbackUrl ? (
                  <p className="break-all">Playback URL: {playbackUrl}</p>
                ) : null}
              </div>
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
              {showDebug && debugLines.length ? (
                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/24">
                    Debug
                  </p>
                  <div className="mt-3 grid gap-1 text-xs text-white/38">
                    {debugLines.map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
