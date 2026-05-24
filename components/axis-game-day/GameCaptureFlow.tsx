"use client"

import { createClient } from "@/lib/supabase/client"
import {
  processingLabel,
  processingProgress,
  type AxisProcessingSnapshot,
  type AxisProcessingState,
} from "@/lib/axis-processing/state"
import { createStoragePath, isSupportedReplayFile } from "@/lib/replayStorage"
import { normalizeUploadResponse, parseUploadResponseText } from "@/lib/uploadResponse"
import { createRecorder, type AxisRecorder } from "@/lib/video/createRecorder"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Upload, isSupported as tusIsSupported } from "tus-js-client"
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

type RecoveryPayload = {
  sessionId: string
  traceId: string
  filePath: string
  fileName: string
  contentType: string
  sizeBytes: number
  durationSeconds: number
  source: "camera" | "upload"
  environment: "game"
  mission: string
  player: string
  client: Record<string, unknown>
}

type UploadDraft = {
  sessionId: string
  traceId: string
  filePath: string
  fileName: string
  contentType: string
  sizeBytes: number
}

const RECOVERY_KEY = "axis.game-day.pending-session"
const UPLOAD_DRAFT_KEY = "axis.game-day.pending-upload"
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

type ProcessingStatusResponse = {
  ok?: boolean
  processing?: AxisProcessingSnapshot
  session?: {
    id: string
    status: string
  }
  summary?: ProcessingSummary
}

type ProcessingSummary = {
  complete: number
  failed: number
  nextType: string | null
  progress: number
  total: number
}

const PROCESSING_STORAGE_KEY = "axis.game-day.processing-session"

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

const UI_STAGE_BY_PROCESSING: Partial<Record<AxisProcessingState, CaptureStage>> = {
  COMPLETE: "complete",
  FAILED: "error",
  GENERATING_BROADCAST: "processing",
  GENERATING_CLIPS: "processing",
  GENERATING_REPLAY: "processing",
  GENERATING_STATS: "processing",
  PROCESSING: "processing",
  QUEUED: "processing",
  TRACKING: "processing",
  UPLOADING: "uploading",
}

function processingText(state: AxisProcessingState) {
  return PROCESSING_DISPLAY[state] || processingLabel(state)
}

function isProcessingTerminal(state: AxisProcessingState) {
  return state === "COMPLETE" || state === "FAILED"
}

function isVisibleProcessingState(state: AxisProcessingState) {
  return state !== "IDLE" && state !== "FAILED"
}

function readStoredProcessingSession() {
  try {
    return localStorage.getItem(PROCESSING_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredProcessingSession(sessionId: string | null) {
  try {
    if (sessionId) {
      localStorage.setItem(PROCESSING_STORAGE_KEY, sessionId)
    } else {
      localStorage.removeItem(PROCESSING_STORAGE_KEY)
    }
  } catch {
    // Local recovery is helpful, not required.
  }
}

function initialProcessingSnapshot(state: AxisProcessingState): AxisProcessingSnapshot {
  return {
    label: processingLabel(state),
    progress: processingProgress(state),
    state,
    updatedAt: new Date().toISOString(),
  }
}

export function GameCaptureFlow() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
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
  const [recovery, setRecovery] = useState<RecoveryPayload | null>(null)
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

      const stored = readRecovery()
      if (stored) {
        setRecovery(stored)
        setStatus("A saved game is ready to continue.")
      }

      const storedProcessingSession = readStoredProcessingSession()
      if (storedProcessingSession) {
        setSessionId(storedProcessingSession)
        setStage("processing")
        setStatus("Checking game processing.")
      }
    }, 0)

    return () => {
      window.clearTimeout(initializeClientState)
      clearPreviewUrl()
      stopStream()
    }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    if (isProcessingTerminal(processing.state)) return

    let cancelled = false

    const refresh = async () => {
      const next = await fetchProcessingStatus(sessionId).catch(() => null)
      if (cancelled || !next) return

      applyProcessingSnapshot(next.processing, next.summary)
    }

    void refresh()
    const interval = window.setInterval(() => void refresh(), 2400)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [processing.state, sessionId])

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
    if (!file) return
    if (!isSupportedReplayFile(file)) {
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

  const retrySessionSave = async () => {
    if (!recovery) return

    setStage("saving")
    setProgress(86)
    setStatus("Continuing game upload.")
    await completeAndProcess(recovery)
  }

  const openReplay = () => {
    if (!sessionId) return
    router.push(`/replay-native?session=${encodeURIComponent(sessionId)}`)
  }

  const canUpload = stage === "ready" || stage === "error"
  const isBusy = stage === "uploading" || stage === "saving" || stage === "processing"
  const showProcessing =
    stage === "saving" ||
    stage === "processing" ||
    stage === "complete" ||
    isVisibleProcessingState(processing.state)
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

          {recovery ? (
            <button className={styles.actionButton} disabled={isBusy} type="button" onClick={() => void retrySessionSave()}>
              Resume Game
            </button>
          ) : null}

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
      setStatus(processingText("UPLOADING"))

      const { data, error } = await supabaseRef.current.auth.getSession()
      const session = data.session
      if (error || !session?.user || !session.access_token) {
        throw new Error("Sign in before uploading a game.")
      }

      setProgress(18)
      setStatus("Preparing game upload.")

      const durationSeconds = await readVideoDuration(file).catch(() => 0)
      const draft = getUploadDraft(file, session.user.id)

      const payload: RecoveryPayload = {
        sessionId: draft.sessionId,
        traceId: draft.traceId,
        filePath: draft.filePath,
        fileName: file.name,
        contentType: file.type || "video/mp4",
        sizeBytes: file.size,
        durationSeconds,
        source,
        environment: "game",
        mission: "Game replay",
        player: "Unassigned",
        client: {
          surface: "game-day",
          userAgent: navigator.userAgent,
          connection: getConnectionLabel(),
        },
      }

      localStorage.setItem(UPLOAD_DRAFT_KEY, JSON.stringify(draft))

      setProgress(28)
      setStatus(processingText("UPLOADING"))

      await uploadWithResume({
        accessToken: session.access_token,
        file,
        onProgress: (percent) => setProgress(Math.min(78, 28 + percent * 0.5)),
        payload,
      })

      localStorage.removeItem(UPLOAD_DRAFT_KEY)
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(payload))
      setRecovery(payload)
      setProgress(78)
      setProcessing(initialProcessingSnapshot("QUEUED"))
      setStatus("Upload complete. Axis is starting.")

      await completeAndProcess(payload)
    } catch (error) {
      setStage("error")
      setStatus(error instanceof Error ? error.message : "Upload paused. Keep this tab open and retry.")
    } finally {
      uploadActiveRef.current = false
    }
  }

  async function completeAndProcess(payload: RecoveryPayload) {
    try {
      setStage("saving")
      setProgress(88)

      const response = await fetch("/api/upload/complete", {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })
      const text = await response.text()
      const completed = normalizeUploadResponse(parseUploadResponseText(text))

      if (!completed.ok || !completed.replayId) {
        throw new Error(completed.recovery || completed.error || "Session save needs another try.")
      }

      localStorage.removeItem(RECOVERY_KEY)
      setRecovery(null)
      setSessionId(completed.replayId)
      writeStoredProcessingSession(completed.replayId)
      setStage("processing")
      setProcessing(initialProcessingSnapshot("QUEUED"))
      setProgress(processingProgress("QUEUED"))
      setStatus(processingText("QUEUED"))

      await attachTelemetry(completed.replayId)

      void fetch("/api/session/jobs", {
        body: JSON.stringify({
          action: "run",
          sessionId: completed.replayId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }).catch(() => undefined)

      const next = await fetchProcessingStatus(completed.replayId).catch(() => null)
      if (next?.processing) {
        applyProcessingSnapshot(next.processing, next.summary)
      }
    } catch (error) {
      setStage("error")
      setStatus(error instanceof Error ? error.message : "Session save needs another try.")
    }
  }

  async function attachTelemetry(replayId: string) {
    const file = telemetryFileRef.current
    if (!file) return

    const form = new FormData()
    form.set("sessionId", replayId)
    form.set("telemetry", file)

    const response = await fetch("/api/session/telemetry", {
      body: form,
      method: "POST",
    })

    if (!response.ok) {
      throw new Error("Memory file attachment needs another try.")
    }
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

  function applyProcessingSnapshot(next: AxisProcessingSnapshot, summary?: ProcessingSummary | null) {
    setProcessing(next)
    setProcessingSummary(summary || null)
    setProgress(Math.max(next.progress, summary?.progress ?? 0))
    setStatus(processingText(next.state))

    const nextStage = UI_STAGE_BY_PROCESSING[next.state]
    if (nextStage) setStage(nextStage)
    if (next.state === "COMPLETE" || next.state === "FAILED") {
      writeStoredProcessingSession(null)
    }
  }
}

async function fetchProcessingStatus(
  sessionId: string
): Promise<(ProcessingStatusResponse & { processing: AxisProcessingSnapshot }) | null> {
  const response = await fetch(
    `/api/session/status?sessionId=${encodeURIComponent(sessionId)}`,
    {
      cache: "no-store",
    }
  )

  if (!response.ok) return null

  const data = (await response.json()) as ProcessingStatusResponse
  if (!data.processing) return null

  return {
    ...data,
    processing: data.processing,
  }
}

function uploadWithResume({
  accessToken,
  file,
  onProgress,
  payload,
}: {
  accessToken: string
  file: File
  onProgress: (percent: number) => void
  payload: RecoveryPayload
}) {
  if (!tusIsSupported) {
    return Promise.reject(new Error("Resumable upload is unavailable in this browser."))
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    return Promise.reject(new Error("Upload configuration unavailable."))
  }

  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      chunkSize: 6 * 1024 * 1024,
      endpoint: getTusEndpoint(),
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
      },
      metadata: {
        bucketName: "axis-replays",
        cacheControl: "3600",
        contentType: payload.contentType,
        objectName: payload.filePath,
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (!bytesTotal) return
        onProgress((bytesUploaded / bytesTotal) * 100)
      },
      onSuccess: () => resolve(),
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
    })

    upload
      .findPreviousUploads()
      .then((previousUploads) => {
        const previous = previousUploads[0]
        if (previous) upload.resumeFromPreviousUpload(previous)
        upload.start()
      })
      .catch(reject)
  })
}

function readRecovery() {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RecoveryPayload
  } catch {
    localStorage.removeItem(RECOVERY_KEY)
    return null
  }
}

function getUploadDraft(file: File, userId: string): UploadDraft {
  const existing = readUploadDraft()

  if (
    existing &&
    existing.fileName === file.name &&
    existing.sizeBytes === file.size &&
    existing.contentType === (file.type || "video/mp4")
  ) {
    return existing
  }

  return {
    sessionId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
    filePath: createStoragePath({
      userId,
      fileName: file.name,
      type: file.type,
    }),
    fileName: file.name,
    contentType: file.type || "video/mp4",
    sizeBytes: file.size,
  }
}

function readUploadDraft() {
  try {
    const raw = localStorage.getItem(UPLOAD_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UploadDraft
  } catch {
    localStorage.removeItem(UPLOAD_DRAFT_KEY)
    return null
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

function getConnectionLabel() {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string }
  }

  return nav.connection?.effectiveType || "unknown"
}

function getTusEndpoint() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return "/storage/v1/upload/resumable"

  const url = new URL(supabaseUrl)
  const projectId = url.hostname.split(".")[0]

  if (!projectId) return `${url.origin}/storage/v1/upload/resumable`

  return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`
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
