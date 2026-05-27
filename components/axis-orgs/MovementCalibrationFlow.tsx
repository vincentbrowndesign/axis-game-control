"use client"

import { useEffect, useRef, useState } from "react"
import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision"
import {
  CALIBRATION_LANGUAGE,
  type CalibrationState,
} from "@/lib/axis-calibration/vocabulary"
import styles from "@/app/page.module.css"

type MotionPrimitive = {
  directionChanged: boolean
  jumped: boolean
  moving: boolean
  stopped: boolean
  visible: boolean
}

type SessionMovementSample = {
  directionChanged: boolean
  jumped: boolean
  movementState: "moving" | "stopped"
  subjectId: string
  timestamp: number
  trackingContinuityConfidence: number
  visibilityState: "visible" | "lost"
}

type MotionBox = {
  height: number
  width: number
  x: number
  y: number
}

const SAMPLE_WIDTH = 96
const SAMPLE_HEIGHT = 54
const DIFF_THRESHOLD = 30
const MOVING_RATIO = 0.035
const STOPPED_RATIO = 0.015

export function MovementCalibrationFlow() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null)
  const previousCenterRef = useRef<{ x: number; y: number } | null>(null)
  const previousDirectionRef = useRef(0)
  const detectorRef = useRef<PoseLandmarker | null>(null)
  const sessionSamplesRef = useRef<SessionMovementSample[]>([])
  const sessionSubjectIdRef = useRef("")
  const streamRef = useRef<MediaStream | null>(null)
  const statusRef = useRef<CalibrationState>(CALIBRATION_LANGUAGE.READY)
  const stoppedSinceRef = useRef<number | null>(null)
  const [status, setStatus] = useState<CalibrationState>(CALIBRATION_LANGUAGE.READY)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  async function startCamera() {
    if (isActive) return

    setPhase(CALIBRATION_LANGUAGE.READY)
    previousFrameRef.current = null
    previousCenterRef.current = null
    previousDirectionRef.current = 0
    sessionSamplesRef.current = []
    sessionSubjectIdRef.current = crypto.randomUUID()
    stoppedSinceRef.current = null

    try {
      await initializeDetector()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "environment",
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      })
      streamRef.current = stream
      setIsActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      frameRef.current = window.requestAnimationFrame(readFrame)
    } catch {
      setIsActive(false)
      setPhase(CALIBRATION_LANGUAGE.LOST)
    }
  }

  function stopCamera() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    detectorRef.current?.close()
    detectorRef.current = null
    setIsActive(false)
  }

  function setPhase(next: CalibrationState) {
    if (statusRef.current === next) return
    statusRef.current = next
    setStatus(next)
  }

  async function initializeDetector() {
    if (detectorRef.current) return

    const { FilesetResolver, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    )
    const wasmFileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    )

    detectorRef.current = await PoseLandmarker.createFromOptions(wasmFileset, {
      baseOptions: {
        delegate: "GPU",
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
      },
      minPoseDetectionConfidence: 0.35,
      minPosePresenceConfidence: 0.35,
      minTrackingConfidence: 0.35,
      numPoses: 1,
      runningMode: "VIDEO",
    })
  }

  async function readFrame() {
    const video = videoRef.current

    if (!video || video.readyState < 2) {
      frameRef.current = window.requestAnimationFrame(readFrame)
      return
    }

    const sampleCanvas = getSampleCanvas()
    const sampleContext = sampleCanvas.getContext("2d", {
      willReadFrequently: true,
    })

    if (!sampleContext) {
      setPhase(CALIBRATION_LANGUAGE.LOST)
      return
    }

    sampleContext.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    const frame = sampleContext.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    const previousFrame = previousFrameRef.current

    if (!previousFrame) {
      previousFrameRef.current = new Uint8ClampedArray(frame.data)
      drawTrackingFrame()
      frameRef.current = window.requestAnimationFrame(readFrame)
      return
    }

    const poseState = await estimateSubject(video)
    const frameState = measureMotion(frame.data, previousFrame)
    previousFrameRef.current = new Uint8ClampedArray(frame.data)

    const primitive = getPrimitive({
      changedRatio: frameState.changedRatio,
      center: poseState.center || frameState.center,
      poseVisible: poseState.visible,
      trackingContinuityConfidence: poseState.trackingContinuityConfidence,
    })
    updatePhase(primitive)
    writeSessionSample(primitive, poseState.trackingContinuityConfidence)
    drawTrackingFrame(poseState.box || frameState.box)

    frameRef.current = window.requestAnimationFrame(readFrame)
  }

  function getSampleCanvas() {
    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement("canvas")
      sampleCanvasRef.current.width = SAMPLE_WIDTH
      sampleCanvasRef.current.height = SAMPLE_HEIGHT
    }

    return sampleCanvasRef.current
  }

  function measureMotion(
    frame: Uint8ClampedArray,
    previousFrame: Uint8ClampedArray,
  ) {
    let changed = 0
    let samples = 0
    let minX = SAMPLE_WIDTH
    let minY = SAMPLE_HEIGHT
    let maxX = 0
    let maxY = 0

    for (let y = 0; y < SAMPLE_HEIGHT; y += 2) {
      for (let x = 0; x < SAMPLE_WIDTH; x += 2) {
        const index = (y * SAMPLE_WIDTH + x) * 4
        const current =
          frame[index] * 0.299 + frame[index + 1] * 0.587 + frame[index + 2] * 0.114
        const previous =
          previousFrame[index] * 0.299 +
          previousFrame[index + 1] * 0.587 +
          previousFrame[index + 2] * 0.114

        samples += 1

        if (Math.abs(current - previous) <= DIFF_THRESHOLD) continue

        changed += 1
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    if (!changed) {
      return {
        box: null,
        center: null,
        changedRatio: 0,
      }
    }

    const box = {
      height: (maxY - minY + 2) / SAMPLE_HEIGHT,
      width: (maxX - minX + 2) / SAMPLE_WIDTH,
      x: minX / SAMPLE_WIDTH,
      y: minY / SAMPLE_HEIGHT,
    }

    return {
      box,
      center: {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      },
      changedRatio: changed / samples,
    }
  }

  async function estimateSubject(video: HTMLVideoElement) {
    const detector = detectorRef.current

    if (!detector) {
      return {
        box: null,
        center: null,
        trackingContinuityConfidence: 0,
        visible: false,
      }
    }

    const result = detector.detectForVideo(video, performance.now())
    const landmarks = result.landmarks[0]

    if (!landmarks) {
      return {
        box: null,
        center: null,
        trackingContinuityConfidence: 0,
        visible: false,
      }
    }

    return readPose(landmarks)
  }

  function readPose(landmarks: NormalizedLandmark[]) {
    const visibleKeypoints = landmarks.filter(
      (landmark) => landmark.visibility > 0.24,
    )

    if (visibleKeypoints.length < 5) {
      return {
        box: null,
        center: null,
        trackingContinuityConfidence: visibleKeypoints.length / 17,
        visible: false,
      }
    }

    const minX = Math.min(...visibleKeypoints.map((landmark) => landmark.x))
    const maxX = Math.max(...visibleKeypoints.map((landmark) => landmark.x))
    const minY = Math.min(...visibleKeypoints.map((landmark) => landmark.y))
    const maxY = Math.max(...visibleKeypoints.map((landmark) => landmark.y))
    const box = {
      height: maxY - minY,
      width: maxX - minX,
      x: minX,
      y: minY,
    }

    return {
      box,
      center: {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      },
      trackingContinuityConfidence: visibleKeypoints.length / 17,
      visible: true,
    }
  }

  function getPrimitive({
    changedRatio,
    center,
    poseVisible,
  }: {
    changedRatio: number
    center: { x: number; y: number } | null
    poseVisible: boolean
    trackingContinuityConfidence: number
  }): MotionPrimitive {
    const previousCenter = previousCenterRef.current
    const moving = changedRatio > MOVING_RATIO
    const stopped = changedRatio < STOPPED_RATIO
    let directionChanged = false
    let jumped = false

    if (center && previousCenter) {
      const deltaX = center.x - previousCenter.x
      const deltaY = center.y - previousCenter.y
      const direction = Math.abs(deltaX) > 0.035 ? Math.sign(deltaX) : 0

      directionChanged =
        direction !== 0 &&
        previousDirectionRef.current !== 0 &&
        direction !== previousDirectionRef.current
      jumped = Math.abs(deltaY) > 0.16

      if (direction !== 0) previousDirectionRef.current = direction
    }

    if (center) previousCenterRef.current = center

    return {
      directionChanged,
      jumped,
      moving,
      stopped,
      visible: poseVisible,
    }
  }

  function writeSessionSample(
    primitive: MotionPrimitive,
    trackingContinuityConfidence: number,
  ) {
    sessionSamplesRef.current.push({
      directionChanged: primitive.directionChanged,
      jumped: primitive.jumped,
      movementState: primitive.moving ? "moving" : "stopped",
      subjectId: sessionSubjectIdRef.current,
      timestamp: Date.now(),
      trackingContinuityConfidence,
      visibilityState: primitive.visible ? "visible" : "lost",
    })

    if (sessionSamplesRef.current.length > 240) {
      sessionSamplesRef.current.shift()
    }
  }

  function updatePhase(primitive: MotionPrimitive) {
    const now = performance.now()

    if (!primitive.visible) {
      setPhase(CALIBRATION_LANGUAGE.LOST)
      return
    }

    if (statusRef.current === CALIBRATION_LANGUAGE.READY) {
      setPhase(CALIBRATION_LANGUAGE.HOLD_STILL)
      return
    }

    if (primitive.stopped) {
      stoppedSinceRef.current ??= now
    } else {
      stoppedSinceRef.current = null
    }

    if (
      statusRef.current === CALIBRATION_LANGUAGE.HOLD_STILL &&
      stoppedSinceRef.current &&
      now - stoppedSinceRef.current > 900
    ) {
      setPhase(CALIBRATION_LANGUAGE.MOVE)
      return
    }

    if (
      statusRef.current === CALIBRATION_LANGUAGE.MOVE &&
      (primitive.moving || primitive.directionChanged || primitive.jumped)
    ) {
      setPhase(CALIBRATION_LANGUAGE.TRACKING)
    }
  }

  function drawTrackingFrame(box?: MotionBox | null) {
    const canvas = canvasRef.current
    const video = videoRef.current

    if (!canvas || !video) return

    const rect = canvas.getBoundingClientRect()
    const pixelRatio = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio))
    canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio))

    const context = canvas.getContext("2d")
    if (!context) return

    context.scale(pixelRatio, pixelRatio)
    context.clearRect(0, 0, rect.width, rect.height)
    context.strokeStyle = "rgba(174, 255, 47, 0.68)"
    context.lineWidth = 1
    context.strokeRect(12, 12, rect.width - 24, rect.height - 24)

    if (!box) return

    const x = 12 + box.x * (rect.width - 24)
    const y = 12 + box.y * (rect.height - 24)
    const width = Math.max(28, box.width * (rect.width - 24))
    const height = Math.max(28, box.height * (rect.height - 24))

    context.strokeStyle = "rgba(255, 255, 255, 0.82)"
    context.strokeRect(x, y, width, height)
    context.fillStyle = "rgba(174, 255, 47, 0.74)"
    context.fillRect(x + width / 2 - 2, y + height / 2 - 2, 4, 4)
  }

  return (
    <section className={styles.calibrationShell}>
      <div className={styles.calibrationViewport}>
        <video
          className={styles.calibrationVideo}
          muted
          playsInline
          ref={videoRef}
        />
        <canvas
          aria-hidden="true"
          className={styles.calibrationCanvas}
          ref={canvasRef}
        />
        {!isActive ? (
          <button
            className={styles.calibrationStart}
            onClick={startCamera}
            type="button"
          >
            {CALIBRATION_LANGUAGE.START}
          </button>
        ) : null}
      </div>
      <div className={styles.calibrationBar}>
        <strong className={styles.calibrationState}>{status}</strong>
        {isActive ? <span>{CALIBRATION_LANGUAGE.ACTIVE}</span> : null}
      </div>
    </section>
  )
}
