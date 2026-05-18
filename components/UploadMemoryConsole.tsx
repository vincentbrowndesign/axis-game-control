"use client"

import { useEffect, useRef, useState } from "react"
import { Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  parseUploadResponseText,
  type AxisUploadResponse,
} from "@/lib/uploadResponse"

type Props = {
  replayMoments: unknown[]
  recentSessions: unknown[]
  playerMoments: unknown[]
}

const waveformBars = [42, 72, 48, 86, 56, 64, 94, 44, 78, 52, 88, 60, 46, 82]

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
  if (data.ok) return "Playback ready. Extraction continuing."
  if (data.recovery) return "Playback ready. Extraction continuing."
  if (data.stored) return "Playback ready. Extraction continuing."
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

function triggerDelayedExtraction(replayId: string, traceId: string) {
  console.info("AXIS MOBILE UPLOAD", {
    traceId,
    stage: "delayed-extraction-start",
    replayId,
  })

  void fetch(`/api/upload/extract/${replayId}`, {
    method: "POST",
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}))

      console.info("AXIS MOBILE UPLOAD", {
        traceId,
        stage: "delayed-extraction-response",
        replayId,
        status: response.status,
        extractionStage:
          typeof data.stage === "string" ? data.stage : "unknown",
      })
    })
    .catch((error) => {
      console.warn("AXIS MOBILE UPLOAD", {
        traceId,
        stage: "delayed-extraction-queued",
        replayId,
        error,
      })
    })
}

async function completeUpload({
  traceId,
  filePath,
  fileName,
  contentType,
  sizeBytes,
  durationSeconds,
  client,
}: {
  traceId: string
  filePath: string
  fileName: string
  contentType: string
  sizeBytes: number
  durationSeconds: number
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
      source: "upload",
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

function readVideoMetadata(file: File, url: string) {
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

export default function UploadMemoryConsole(props: Props) {
  void props
  const inputRef = useRef<HTMLInputElement | null>(null)
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
    setStatus("Preparing playback")
    setProcessingLine("Reading the footage")
    setUploadProgress(0)
    setDebugTraceId("")
    const uploadInfo = mobileUploadInfo(file)
    setDebugTraceId(uploadInfo.traceId)

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
      setStatus("Playback ready. Saving video.")
      setProcessingLine("Your footage is safe here first.")
      void previewRef.current?.play().catch(() => undefined)

      const metadata = await readVideoMetadata(file, localUrl)
      const safeDuration = Math.max(0, Math.floor(metadata.duration))
      const minutes = Math.floor(safeDuration / 60)
      const seconds = safeDuration % 60
      setDurationLabel(`${minutes}:${seconds.toString().padStart(2, "0")}`)
      localVideoUrlRef.current = metadata.url

      setStatus("Uploading video")
      setProcessingLine("Saving directly to playback storage.")
      setUploadProgress(12)

      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(userError?.message || "Sign in required")
      }

      const filePath = `${user.id}/${safeStorageName(uploadInfo.uploadName)}`
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
          throw uploaded.error
        }

        setUploadProgress(78)
        setProcessingLine("Playback copy saved. Opening it now.")

        const signed = await supabase.storage
          .from("axis-replays")
          .createSignedUrl(filePath, 60 * 60 * 24 * 7)

        if (!signed.error && signed.data?.signedUrl) {
          setPlaybackUrl(signed.data.signedUrl)
        }

        const result = await completeUpload({
          traceId: uploadInfo.traceId,
          filePath,
          fileName: uploadInfo.uploadName,
          contentType: uploadInfo.uploadType,
          sizeBytes: file.size,
          durationSeconds: metadata.duration,
          client: clientDebug,
        })

        setUploadProgress(100)
        setStatus(uploadStatus(result))
        if (result.videoUrl) {
          setPlaybackUrl(result.videoUrl)
        }
        setProcessingLine("Playback ready. Extraction continuing.")
        if (result.replayId) {
          triggerDelayedExtraction(
            result.replayId,
            result.traceId || uploadInfo.traceId
          )
        }
      } catch (error) {
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
          throw retry.error
        }

        setUploadProgress(82)
        const signed = await supabase.storage
          .from("axis-replays")
          .createSignedUrl(retryPath, 60 * 60 * 24 * 7)

        if (!signed.error && signed.data?.signedUrl) {
          setPlaybackUrl(signed.data.signedUrl)
        }

        const result = await completeUpload({
          traceId: uploadInfo.traceId,
          filePath: retryPath,
          fileName: uploadInfo.uploadName,
          contentType: uploadInfo.uploadType,
          sizeBytes: file.size,
          durationSeconds: metadata.duration,
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
        setProcessingLine("Playback ready. Extraction continuing.")
        if (result.replayId) {
          triggerDelayedExtraction(
            result.replayId,
            result.traceId || uploadInfo.traceId
          )
        }
      }
    } catch (error) {
      console.error("UPLOAD MEMORY FAILED", error)
      setStatus("Still processing...")
      setProcessingLine("Playback stays here. Axis will keep trying.")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
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
            <p className="text-sm font-bold text-white/38">Upload first</p>
            <h1 className="mt-4 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.065em] text-white sm:text-8xl">
              Save the footage.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/48">
              Choose basketball video from your phone. Axis saves the footage
              first and keeps playback available while extraction continues.
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
                    : "Playback appears before extraction finishes"}
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
                {playbackUrl ? "PLAYBACK READY" : "CHOOSE FILE"}
              </p>
              <p className="mt-4 text-sm leading-6 text-white/42">
                {playbackTitle || "The saved video becomes watchable first."}
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
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
