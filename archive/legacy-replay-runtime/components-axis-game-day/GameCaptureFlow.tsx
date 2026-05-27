"use client"

import {
  processingLabel,
  processingProgress,
  type AxisProcessingSnapshot,
  type AxisProcessingState,
} from "@/lib/axis-processing/state"
import { isSupportedReplayFile } from "@/lib/replayStorage"
import { normalizeUploadResponse, parseUploadResponseText } from "@/lib/uploadResponse"
import { createRecorder, type AxisRecorder } from "@/lib/video/createRecorder"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import styles from "./GameCaptureFlow.module.css"

type CaptureStage =
  | "idle"
  | "recording"
  | "ready"
  | "uploading"
  | "saving"
  | "processing"
  | "complete"
  | "error"

const PROCESSING_STEPS = [
  "QUEUED",
  "PROCESSING",
  "TRACKING",
  "GENERATING_REPLAY",
  "GENERATING_CLIPS",
  "GENERATING_STATS",
  "GENERATING_BROADCAST",
  "COMPLETE",
] satisfies AxisProcessingState[]

type ProcessingSummary = {
  complete: number
  failed: number
  nextType: string | null
  progress: number
  total: number
}

const DEBUG_PREFIX = "[Axis Game Day Upload]"

const PROCESSING_DISPLAY: Record<AxisProcessingState, string> = {
  COMPLETE: "Broadcast ready.",
  FAILED: "Processing needs another try.",
  GENERATING_BROADCAST: "Creating broadcast...",
  GENERATING_CLIPS: "Generating clips...",
  GENERATING_REPLAY: "Building replay memory...",
  GENERATING_STATS: "Generating stats...",
  IDLE: "Ready for game film.",
  PROCESSING: "Processing game...",
  QUEUED: "Processing game...",
  TRACKING: "Detecting moments...",
  UPLOADING: "Uploading game...",
}

function processingText(state: AxisProcessingState) {
  return PROCESSING_DISPLAY[state] || processingLabel(state)
}

function initialProcessingSnapshot(state: AxisProcessingState): AxisProcessingSnapshot {
  return {
    label: processingLabel(state),
    progress: processingProgress(state),
    state,
    updatedAt: new Date().toISOString(),
  }
}

function debugUploadStep(step: string, details?: Record<string, unknown>) {
  console.log(DEBUG_PREFIX, step, details || {})
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function GameCaptureFlow() {
  const router = useRouter()
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<AxisRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<File | null>(null)
  const telemetryFileRef = useRef<File | null>(null)
  const sourceRef = useRef<"camera" | "upload">("upload")
  const objectUrlRef = useRef<string | null>(null)
  const uploadActiveRef = useRef(false)

  const [stage, setStage] = useState<CaptureStage>("idle")
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("Choose or record a game.")
  const [fileName, setFileName] = useState("No video selected")
  const [telemetryName, setTelemetryName] = useState("Optional memory file")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [recordingReady, setRecordingReady] = useState(false)
  const [hasSelectedFile, setHasSelectedFile] = useState(false)
  const [processing, setProcessing] = useState<AxisProcessingSnapshot>(
    initialProcessingSnapshot("IDLE")
  )
  const [processingSummary, setProcessingSummary] = useState<ProcessingSummary | null>(null)

  useEffect(() => {
    const initializeClientState = window.setTimeout(() => {
      setRecordingReady(
        Boolean(navigator.mediaDevices?.getUserMedia) &&
          typeof MediaRecorder !== "undefined"
      )

    }, 0)

    return () => {
      window.clearTimeout(initializeClientState)
      clearPreviewUrl()
      stopStream()
    }
  }, [])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!uploadActiveRef.current) return
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  const chooseFile = (file: File | null) => {
    debugUploadStep("1:file-select", {
      hasFile: Boolean(file),
      name: file?.name,
      size: file?.size,
      type: file?.type,
    })

    if (!file) return
    if (!isSupportedReplayFile(file)) {
      debugUploadStep("1:file-select-rejected", {
        name: file.name,
        size: file.size,
        type: file.type,
      })
      setStage("error")
      setStatus("Choose a video file recorded from the game.")
      return
    }

    setSelectedFile(file, "upload")
    setStage("ready")
    setProgress(0)
    setStatus("Game ready. Upload when the connection is steady.")
  }

  const startRecording = async () => {
    try {
      setStage("idle")
      setStatus("Opening camera.")

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: { ideal: "environment" },
          height: { ideal: 1080 },
          width: { ideal: 1920 },
        },
      })

      stopStream()
      streamRef.current = stream

      const video = previewRef.current
      if (video) {
        video.srcObject = stream
        video.muted = true
        await video.play().catch(() => undefined)
      }

      recorderRef.current = createRecorder({ stream, timeslice: 4000 })
      recorderRef.current.start()
      setStage("recording")
      setProgress(0)
      setStatus("Recording game.")
    } catch {
      setStage("error")
      setStatus("Camera unavailable. Choose a recorded video instead.")
      stopStream()
    }
  }

  const stopRecording = async () => {
    const recorder = recorderRef.current
    if (!recorder) return

    try {
      setStatus("Saving recording on this device.")
      const blob = await recorder.stop()
      stopStream()

      const extension = blob.type.includes("mp4") ? "mp4" : "webm"
      const recordedFile = new File([blob], `axis-game-${Date.now()}.${extension}`, {
        lastModified: Date.now(),
        type: blob.type || "video/webm",
      })

      setSelectedFile(recordedFile, "camera")
      setStage("ready")
      setStatus("Game ready. Upload when the connection is steady.")
    } catch {
      setStage("error")
      setStatus("Recording stopped before it could be saved.")
      stopStream()
    }
  }

  const cancelRecording = () => {
    recorderRef.current?.cancel()
    recorderRef.current = null
    stopStream()
    setStage("idle")
    setStatus("Choose or record a game.")
  }

  const uploadSelectedFile = async () => {
    const file = fileRef.current
    debugUploadStep("3:upload-click", {
      hasFile: Boolean(file),
      name: file?.name,
      size: file?.size,
      source: sourceRef.current,
    })

    if (!file) {
      setStage("error")
      setStatus("Choose or record a video first.")
      return
    }

    await runUpload(file, sourceRef.current)
  }

  const chooseTelemetryFile = (file: File | null) => {
    if (!file) return
    telemetryFileRef.current = file
    setTelemetryName(file.name)
    setStatus("Memory file added.")
  }

  const openReplay = () => {
    if (!sessionId) return
    router.push(`/replay-native?session=${encodeURIComponent(sessionId)}`)
  }

  const canUpload = stage === "ready" || stage === "error"
  const isBusy = stage === "uploading" || stage === "saving" || stage === "processing"
  const showProcessing =
    stage === "saving" ||
    stage === "processing"
  const processingIndex = getProcessingIndex(processing.state)
  const visibleProgress = Math.max(
    0,
    Math.min(100, processingSummary?.progress ?? progress)
  )
  const completedSteps = processingSummary?.complete ?? Math.max(0, processingIndex)
  const totalSteps = processingSummary?.total ?? PROCESSING_STEPS.length

  return (
    <main className={styles.surface}>
      <header className={styles.telemetry}>
        <div>
          <p className={styles.eyebrow}>AXIS GAME DAY</p>
          <h1 className={styles.title}>Game media</h1>
        </div>
        <span className={styles.stage}>{stageLabel(stage)}</span>
      </header>

      <section className={styles.world} aria-label="Game video capture">
        <div className={styles.videoShell}>
          <video
            ref={previewRef}
            className={styles.video}
            controls={stage === "ready" || stage === "complete"}
            muted={stage === "recording"}
            playsInline
            preload="metadata"
          />
          {!hasSelectedFile && stage !== "recording" ? (
            <div className={styles.emptySignal}>choose or record a game</div>
          ) : null}
          {showProcessing ? (
            <div className={styles.processingLayer} aria-live="polite">
              <div className={styles.processingPanel}>
                <p className={styles.processingEyebrow}>AXIS PROCESSING</p>
                <h2 className={styles.processingTitle}>
                  {processingText(processing.state)}
                </h2>
                <div className={styles.processingMeter} aria-hidden="true">
                  <span
                    className={styles.processingMeterFill}
                    style={{ width: `${visibleProgress}%` }}
                  />
                </div>
                <div className={styles.processingMeta}>
                  <span>
                    {processing.state === "COMPLETE"
                      ? "Replay, clips, stats, and broadcast are ready."
                      : "Axis is turning this game into media."}
                  </span>
                  <span>{completedSteps}/{totalSteps}</span>
                </div>
                <div className={styles.processingSteps}>
                  {PROCESSING_STEPS.map((step, index) => (
                    <span
                      className={[
                        styles.processingStep,
                        index === processingIndex ? styles.processingStepActive : "",
                        index < processingIndex || processing.state === "COMPLETE" ? styles.processingStepDone : "",
                      ].filter(Boolean).join(" ")}
                      key={step}
                    >
                      {processingText(step)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.controlRail} aria-label="Game media controls">
        <div className={styles.progressTrack}>
          <span className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.statusRow}>
          <span>{status}</span>
          <span>{fileName} / {telemetryName}</span>
        </div>

        <div className={styles.actions}>
          <label className={styles.actionButton} aria-disabled={isBusy || stage === "recording"}>
            Choose Game
            <input
              className={styles.fileInput}
              type="file"
              accept="video/*"
              disabled={isBusy || stage === "recording"}
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className={styles.actionButton} aria-disabled={isBusy || stage === "recording"}>
            Add Memory
            <input
              className={styles.fileInput}
              type="file"
              accept=".ndjson,.json,application/json"
              disabled={isBusy || stage === "recording"}
              onChange={(event) => chooseTelemetryFile(event.target.files?.[0] ?? null)}
            />
          </label>

          {stage === "recording" ? (
            <>
              <button className={styles.actionButton} type="button" onClick={() => void stopRecording()}>
                Stop
              </button>
              <button className={styles.quietButton} type="button" onClick={cancelRecording}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className={styles.actionButton}
              disabled={!recordingReady || isBusy}
              type="button"
              onClick={() => void startRecording()}
            >
              Record
            </button>
          )}

          <button
            className={styles.primaryButton}
            disabled={!canUpload || isBusy || !hasSelectedFile}
            type="button"
            onClick={() => void uploadSelectedFile()}
          >
            Upload Game
          </button>

          {sessionId ? (
            <button className={styles.primaryButton} type="button" onClick={openReplay}>
              Open Replay
            </button>
          ) : null}
        </div>
      </section>
    </main>
  )

  async function runUpload(file: File, source: "camera" | "upload") {
    try {
      uploadActiveRef.current = true
      setStage("uploading")
      setProcessing(initialProcessingSnapshot("UPLOADING"))
      setProcessingSummary(null)
      setProgress(8)
      setStatus("Uploading game.")

      setProgress(18)
      setStatus("Preparing game upload.")

      const durationSeconds = await readVideoDuration(file).catch(() => 0)
      const clientTraceId = crypto.randomUUID()
      const form = new FormData()
      form.set("file", file)
      form.set("duration", String(durationSeconds))
      form.set("source", source)
      form.set("environment", "game")
      form.set("mission", "Game replay")
      form.set("player", "Unassigned")
      form.set("clientTraceId", clientTraceId)
      form.set("clientName", file.name)
      form.set("clientType", file.type || "video/mp4")
      form.set("clientSize", String(file.size))
      form.set("clientLastModified", String(file.lastModified || 0))
      form.set("clientUserAgent", navigator.userAgent)
      form.set("clientIsMobile", String(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)))
      form.set("clientIsIOS", String(/iPhone|iPad|iPod/i.test(navigator.userAgent)))
      form.set("clientIsSafari", String(/^((?!chrome|android).)*safari/i.test(navigator.userAgent)))
      form.set("clientViewport", `${window.innerWidth}x${window.innerHeight}`)

      debugUploadStep("3:upload-payload-ready", {
        clientTraceId,
        contentType: file.type || "video/mp4",
        durationSeconds,
        sizeBytes: file.size,
      })

      setProgress(28)
      setStatus("Uploading game.")

      debugUploadStep("4:upload-route-request", {
        clientTraceId,
        fileName: file.name,
        sizeBytes: file.size,
      })

      const response = await fetch("/api/upload", {
        body: form,
        method: "POST",
      })
      const responseContentType = response.headers.get("content-type") || ""
      const text = await response.text()
      const completed = normalizeUploadResponse(parseUploadResponseText(text))

      debugUploadStep("4:upload-route-response", {
        filePath: completed.filePath,
        ok: response.ok,
        replayId: completed.replayId,
        responseContentType,
        status: response.status,
        stored: completed.stored,
        text,
      })

      if (!response.ok || !completed.ok || !completed.stored || !completed.replayId) {
        throw new Error(completed.recovery || completed.error || "Upload save needs another try.")
      }

      setSessionId(completed.replayId)
      debugUploadStep("6:session-created", {
        createdAt: completed.createdAt,
        fileName: completed.fileName,
        filePath: completed.filePath,
        replayId: completed.replayId,
        stage: completed.stage,
        status: completed.status,
        traceId: completed.traceId,
      })
      setStage("processing")
      setProcessing(initialProcessingSnapshot("QUEUED"))
      setProgress(42)
      setStatus("Processing game.")

      await pollProcessingStatus(completed.replayId)
    } catch (error) {
      setStage("error")
      setProcessing(initialProcessingSnapshot("IDLE"))
      setStatus(error instanceof Error ? error.message : "Upload paused. Keep this tab open and retry.")
    } finally {
      uploadActiveRef.current = false
    }
  }

  async function pollProcessingStatus(replayId: string) {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      const response = await fetch(
        `/api/session/status?sessionId=${encodeURIComponent(replayId)}`,
        { cache: "no-store" }
      )

      if (!response.ok) {
        await delay(1500)
        continue
      }

      const payload = await response.json() as {
        processing?: AxisProcessingSnapshot
        summary?: ProcessingSummary
      }

      if (payload.processing) {
        setProcessing(payload.processing)
        setProgress(payload.processing.progress)
        setStatus(processingText(payload.processing.state))
      }

      if (payload.summary) {
        setProcessingSummary(payload.summary)
      }

      if (payload.processing?.state === "COMPLETE") {
        setStage("complete")
        setProgress(100)
        setStatus("Game media ready.")
        return
      }

      if (payload.processing?.state === "FAILED") {
        throw new Error("Processing needs another try.")
      }

      await delay(1500)
    }

    setStage("complete")
    setStatus("Upload saved. Processing will continue.")
  }

  function setSelectedFile(file: File, source: "camera" | "upload") {
    fileRef.current = file
    sourceRef.current = source
    setHasSelectedFile(true)
    setFileName(`${file.name} - ${formatBytes(file.size)}`)
    clearPreviewUrl()

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url

    const video = previewRef.current
    if (video) {
      video.srcObject = null
      video.src = url
      video.currentTime = 0
      video.onloadedmetadata = () => {
        debugUploadStep("2:preview-metadata-loaded", {
          duration: video.duration,
          height: video.videoHeight,
          name: file.name,
          width: video.videoWidth,
        })
      }
      video.oncanplay = () => {
        debugUploadStep("2:preview-can-play", {
          name: file.name,
        })
      }
      video.onerror = () => {
        debugUploadStep("2:preview-error", {
          name: file.name,
        })
      }
      void video.play().catch(() => undefined)
    }
  }

  function clearPreviewUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video")
    const url = URL.createObjectURL(file)

    video.preload = "metadata"
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Video metadata unavailable."))
    }
    video.src = url
  })
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB"
  const megabytes = bytes / 1024 / 1024
  if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`
  return `${(megabytes / 1024).toFixed(2)} GB`
}

function stageLabel(stage: CaptureStage) {
  if (stage === "recording") return "Recording"
  if (stage === "uploading") return "Uploading"
  if (stage === "saving") return "Processing"
  if (stage === "processing") return "Processing"
  if (stage === "complete") return "Ready"
  if (stage === "error") return "Check"
  if (stage === "ready") return "Ready"
  return "Waiting"
}

function getProcessingIndex(state: AxisProcessingState) {
  const index = (PROCESSING_STEPS as readonly AxisProcessingState[]).indexOf(state)
  return index >= 0 ? index : 0
}
