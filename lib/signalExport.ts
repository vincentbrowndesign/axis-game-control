import type { AxisSnapshot } from "@/lib/axisChronologyStore"

export type SignalExportStatus =
  | "IDLE"
  | "DOWNLOADING"
  | "RENDERING"
  | "PREPARING_TRANSFER"
  | "SUCCESS"
  | "FAILED"

type SignalExportOptions = {
  playbackUrl: string
  signal: SignalRenderInput
  title: string
  onStatus?: (status: SignalExportStatus) => void
}

export type SignalRenderInput = {
  sessionId: string
  nodeId: string
  chronologyAnchor: number
  replayEnvelopeStart: number
  replayEnvelopeEnd: number
  kineticDensity: number
  acousticPeak: number
  annotation?: string
  snapshotImage?: string
  motionField?: SignalMotionVector[]
  opticalDepth?: 0.5 | 1 | 2 | 2.5
}

export type SignalMotionVector = {
  x: number
  y: number
  dx: number
  dy: number
  energy: number
}

type SignalGhostBox = {
  x: number
  y: number
  width: number
  height: number
  energy: number
}

type SignalTensionZone = {
  x: number
  y: number
  radius: number
  energy: number
}

const outputWidth = 720
const outputHeight = 1280
const pulseDurationMs = 520
const freezeDurationMs = 1250
const prerollSeconds = 1.6
const postrollSeconds = 1.9
const displayFont = '"Space Grotesk", "Space Grotesk Fallback", ui-sans-serif, system-ui, sans-serif'
const monoFont =
  '"IBM Plex Mono", "IBM Plex Mono Fallback", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

export function buildSnapshotSignalInput({
  sessionId,
  snapshot,
  nodeId,
  duration,
  kineticDensity = 0,
  acousticPeak = 0,
}: {
  sessionId: string
  snapshot: AxisSnapshot
  nodeId: string
  duration: number
  kineticDensity?: number
  acousticPeak?: number
}): SignalRenderInput {
  const anchorTime = Math.max(0, Number(snapshot.session_time) || 0)
  const safeDuration = Math.max(anchorTime, Number(duration) || 0)
  const snapshotImage = snapshot.image_url || snapshot.localUrl || undefined

  return {
    sessionId,
    nodeId,
    chronologyAnchor: anchorTime,
    replayEnvelopeStart: Math.max(0, anchorTime - prerollSeconds),
    replayEnvelopeEnd: Math.min(
      safeDuration || anchorTime + postrollSeconds,
      anchorTime + postrollSeconds
    ),
    kineticDensity: clamp01(kineticDensity),
    acousticPeak: clamp01(acousticPeak),
    annotation: snapshot.annotation?.trim() || undefined,
    snapshotImage,
    motionField: createDefaultMotionField(clamp01(kineticDensity)),
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function createDefaultMotionField(energy: number): SignalMotionVector[] {
  const normalizedEnergy = clamp01(energy)
  const base = 0.18 + normalizedEnergy * 0.52

  return [
    { x: 0.22, y: 0.34, dx: 0.11, dy: -0.02, energy: base * 0.62 },
    { x: 0.5, y: 0.48, dx: 0.16, dy: 0.01, energy: base },
    { x: 0.72, y: 0.62, dx: 0.09, dy: 0.035, energy: base * 0.72 },
  ]
}

function ghostBoxesFromMotionField(
  motionField: SignalMotionVector[] | undefined
): SignalGhostBox[] {
  return (motionField || []).map((vector) => ({
    x: vector.x - 0.045,
    y: vector.y - 0.06,
    width: 0.09 + clamp01(vector.energy) * 0.045,
    height: 0.12 + clamp01(vector.energy) * 0.05,
    energy: vector.energy,
  }))
}

function tensionZonesFromMotionField(
  motionField: SignalMotionVector[] | undefined
): SignalTensionZone[] {
  if (!motionField?.length) return []

  const totalEnergy = motionField.reduce((sum, vector) => sum + clamp01(vector.energy), 0) || 1
  const center = motionField.reduce(
    (zone, vector) => {
      const energy = clamp01(vector.energy)
      return {
        x: zone.x + vector.x * energy,
        y: zone.y + vector.y * energy,
      }
    },
    { x: 0, y: 0 }
  )

  return [
    {
      x: center.x / totalEnergy,
      y: center.y / totalEnergy,
      radius: 0.16,
      energy: clamp01(totalEnergy / motionField.length),
    },
  ]
}

function safeExportTitle(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)

  return cleaned || "axis-signal"
}

function supportedRecorderType() {
  if (typeof MediaRecorder === "undefined") return ""

  return (
    [
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) || ""
  )
}

function extensionForMimeType(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm"
}

function waitForEvent(target: EventTarget, eventName: string, timeoutMs = 3000) {
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => {
      target.removeEventListener(eventName, handleEvent)
      resolve()
    }, timeoutMs)

    const handleEvent = () => {
      window.clearTimeout(timeout)
      resolve()
    }

    target.addEventListener(eventName, handleEvent, {
      once: true,
    })
  })
}

async function seekVideo(video: HTMLVideoElement, time: number) {
  const target = Math.min(Math.max(0, time), Number.isFinite(video.duration) ? video.duration : time)

  if (Math.abs(video.currentTime - target) < 0.04) return

  video.currentTime = target
  await waitForEvent(video, "seeked")
}

async function loadImage(source: string | undefined) {
  if (!source) return null

  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = source
  })
}

function drawVideoCover(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  opticalDepth = 1
) {
  const sourceWidth = video.videoWidth || width
  const sourceHeight = video.videoHeight || height
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = width / height
  let drawWidth = width
  let drawHeight = height
  let x = 0
  let y = 0

  if (sourceRatio > targetRatio) {
    drawHeight = height
    drawWidth = height * sourceRatio
    x = (width - drawWidth) / 2
  } else {
    drawWidth = width
    drawHeight = width / sourceRatio
    y = (height - drawHeight) / 2
  }

  const safeDepth = Math.min(2.5, Math.max(0.5, Number(opticalDepth) || 1))
  const scaledWidth = drawWidth * safeDepth
  const scaledHeight = drawHeight * safeDepth

  context.drawImage(
    video,
    x - (scaledWidth - drawWidth) / 2,
    y - (scaledHeight - drawHeight) / 2,
    scaledWidth,
    scaledHeight
  )
}

function drawAxisWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity = 0
) {
  context.save()
  context.font = `800 18px ${monoFont}`
  context.letterSpacing = "2px"
  context.shadowColor = "rgba(242,241,237,0.18)"
  context.shadowBlur = 8 + intensity * 8
  context.fillStyle = `rgba(242,241,237,${0.28 + intensity * 0.08})`
  context.fillText("AXIS", 42, height - 42)
  context.restore()
}

function drawSnapshotImageLock(
  context: CanvasRenderingContext2D,
  snapshotImage: HTMLImageElement | null,
  width: number,
  height: number,
  opacity: number
) {
  if (!snapshotImage) return

  context.save()
  context.globalAlpha = opacity
  context.globalCompositeOperation = "screen"

  const imageRatio = snapshotImage.naturalWidth / snapshotImage.naturalHeight
  const targetWidth = width * 0.3
  const targetHeight = targetWidth / imageRatio
  const x = width - targetWidth - 42
  const y = height - targetHeight - 56

  context.drawImage(snapshotImage, x, y, targetWidth, targetHeight)
  context.strokeStyle = "rgba(242,241,237,0.2)"
  context.lineWidth = 1
  context.strokeRect(x, y, targetWidth, targetHeight)
  context.restore()
}

function drawMotionField(
  context: CanvasRenderingContext2D,
  motionField: SignalMotionVector[] | undefined,
  width: number,
  height: number,
  kineticDensity: number
) {
  if (!motionField?.length) return

  context.save()
  context.globalCompositeOperation = "screen"
  context.lineCap = "round"

  motionField.forEach((vector) => {
    const energy = clamp01(vector.energy) * (0.28 + kineticDensity * 0.62)
    const startX = vector.x * width
    const startY = vector.y * height
    const endX = startX + vector.dx * width
    const endY = startY + vector.dy * height

    context.strokeStyle = `rgba(242,241,237,${0.08 + energy * 0.2})`
    context.lineWidth = 0.7 + energy * 1.4
    context.beginPath()
    context.moveTo(startX, startY)
    context.lineTo(endX, endY)
    context.stroke()
  })

  context.restore()
}

function drawGhostTrackingBoxes(
  context: CanvasRenderingContext2D,
  boxes: SignalGhostBox[],
  width: number,
  height: number,
  pulse: number
) {
  if (!boxes.length) return

  context.save()
  context.globalCompositeOperation = "screen"

  boxes.forEach((box) => {
    const energy = clamp01(box.energy)
    const x = box.x * width
    const y = box.y * height
    const boxWidth = box.width * width
    const boxHeight = box.height * height
    const alpha = 0.055 + energy * 0.1 + pulse * 0.035

    context.strokeStyle = `rgba(242,241,237,${alpha})`
    context.lineWidth = 0.7
    context.strokeRect(x, y, boxWidth, boxHeight)

    context.strokeStyle = `rgba(242,241,237,${alpha * 1.2})`
    context.beginPath()
    context.moveTo(x, y + 10)
    context.lineTo(x, y)
    context.lineTo(x + 10, y)
    context.moveTo(x + boxWidth - 10, y)
    context.lineTo(x + boxWidth, y)
    context.lineTo(x + boxWidth, y + 10)
    context.moveTo(x, y + boxHeight - 10)
    context.lineTo(x, y + boxHeight)
    context.lineTo(x + 10, y + boxHeight)
    context.moveTo(x + boxWidth - 10, y + boxHeight)
    context.lineTo(x + boxWidth, y + boxHeight)
    context.lineTo(x + boxWidth, y + boxHeight - 10)
    context.stroke()
  })

  context.restore()
}

function drawTensionZones(
  context: CanvasRenderingContext2D,
  zones: SignalTensionZone[],
  width: number,
  height: number,
  pulse: number
) {
  if (!zones.length) return

  context.save()
  context.globalCompositeOperation = "screen"

  zones.forEach((zone) => {
    const energy = clamp01(zone.energy)
    const radius = zone.radius * width * (0.92 + pulse * 0.08)
    const gradient = context.createRadialGradient(
      zone.x * width,
      zone.y * height,
      0,
      zone.x * width,
      zone.y * height,
      radius
    )

    gradient.addColorStop(0, `rgba(215,192,138,${0.024 + energy * 0.055})`)
    gradient.addColorStop(0.45, `rgba(242,241,237,${0.01 + energy * 0.018})`)
    gradient.addColorStop(1, "rgba(242,241,237,0)")

    context.fillStyle = gradient
    context.beginPath()
    context.arc(zone.x * width, zone.y * height, radius, 0, Math.PI * 2)
    context.fill()
  })

  context.restore()
}

function drawKineticHalos(
  context: CanvasRenderingContext2D,
  motionField: SignalMotionVector[] | undefined,
  width: number,
  height: number,
  pulse: number
) {
  if (!motionField?.length || pulse < 0.08) return

  context.save()
  context.globalCompositeOperation = "screen"

  motionField.forEach((vector) => {
    const energy = clamp01(vector.energy)
    if (energy < 0.22) return

    context.strokeStyle = `rgba(185,215,191,${pulse * energy * 0.2})`
    context.lineWidth = 0.8
    context.beginPath()
    context.arc(vector.x * width, vector.y * height, (16 + energy * 36) * pulse, 0, Math.PI * 2)
    context.stroke()
  })

  context.restore()
}

function drawSignalPerceptionLayer(
  context: CanvasRenderingContext2D,
  signal: SignalRenderInput,
  width: number,
  height: number,
  pulse: number
) {
  const kineticDensity = clamp01(signal.kineticDensity)

  drawTensionZones(
    context,
    tensionZonesFromMotionField(signal.motionField),
    width,
    height,
    pulse
  )
  drawMotionField(context, signal.motionField, width, height, kineticDensity)
  drawGhostTrackingBoxes(
    context,
    ghostBoxesFromMotionField(signal.motionField),
    width,
    height,
    pulse
  )
  drawKineticHalos(context, signal.motionField, width, height, pulse)
}

function drawPulseIntro(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  acousticPeak: number
) {
  context.save()
  context.fillStyle = "#050505"
  context.fillRect(0, 0, width, height)

  const pulse = Math.sin(progress * Math.PI)
  context.fillStyle = `rgba(242,241,237,${0.9})`
  context.font = `900 34px ${displayFont}`
  context.shadowColor = `rgba(242,241,237,${0.12 + pulse * (0.1 + acousticPeak * 0.08)})`
  context.shadowBlur = 10 + pulse * 10
  context.fillText("AXIS", 42, height / 2)
  context.restore()
}

function drawTrailFrame(
  context: CanvasRenderingContext2D,
  trailCanvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  kineticDensity: number
) {
  if (!trailCanvas) return

  context.save()
  context.globalAlpha = 0.035 + kineticDensity * 0.075
  context.globalCompositeOperation = "screen"
  context.drawImage(trailCanvas, -1 - kineticDensity * 3, 0, width + 2 + kineticDensity * 6, height)
  context.restore()
}

async function recordTimedFrames(
  render: (elapsedMs: number, progress: number) => void,
  durationMs: number
) {
  const startedAt = performance.now()

  while (performance.now() - startedAt < durationMs) {
    const elapsed = performance.now() - startedAt
    render(elapsed, Math.min(1, elapsed / durationMs))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  render(durationMs, 1)
}

async function shareOrDownload(blob: Blob, title: string, mimeType: string) {
  const fileName = `${safeExportTitle(title)}.${extensionForMimeType(mimeType)}`
  const file =
    typeof File !== "undefined"
      ? new File([blob], fileName, {
          type: mimeType || blob.type || "video/webm",
          lastModified: Date.now(),
        })
      : null

  if (file && navigator.share) {
    const payload = {
      files: [file],
      title,
    }

    if (!navigator.canShare || navigator.canShare(payload)) {
      await navigator.share(payload)
      return
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = "noopener"
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 10000)
}

export async function exportSnapshotSignal({
  playbackUrl,
  signal,
  title,
  onStatus,
}: SignalExportOptions) {
  if (typeof window === "undefined" || typeof document === "undefined") return

  const mimeType = supportedRecorderType()
  if (!mimeType) {
    throw new Error("SIGNAL_RECORDER_UNAVAILABLE")
  }

  onStatus?.("DOWNLOADING")
  const sourceResponse = await fetch(playbackUrl)
  if (!sourceResponse.ok) {
    throw new Error("SIGNAL_SOURCE_UNAVAILABLE")
  }

  const sourceBlob = await sourceResponse.blob()
  const sourceUrl = URL.createObjectURL(sourceBlob)
  const canvas = document.createElement("canvas")
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext("2d", {
    alpha: false,
  })

  if (!context) {
    URL.revokeObjectURL(sourceUrl)
    throw new Error("SIGNAL_CANVAS_UNAVAILABLE")
  }

  const video = document.createElement("video")
  video.src = sourceUrl
  video.muted = true
  video.playsInline = true
  video.preload = "auto"

  await waitForEvent(video, "loadedmetadata", 5000)
  const snapshotImage = await loadImage(signal.snapshotImage)

  const stream = canvas.captureStream(30)
  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_500_000,
  })
  const anchorTime = Math.min(
    Math.max(0, Number(signal.chronologyAnchor) || 0),
    Number.isFinite(video.duration) ? video.duration : Number(signal.chronologyAnchor) || 0
  )
  const startTime = Math.min(
    anchorTime,
    Math.max(0, Number(signal.replayEnvelopeStart) || anchorTime - prerollSeconds)
  )
  const endTime = Math.min(
    Number.isFinite(video.duration) ? video.duration : anchorTime + postrollSeconds,
    Math.max(anchorTime, Number(signal.replayEnvelopeEnd) || anchorTime + postrollSeconds)
  )
  const kineticDensity = clamp01(signal.kineticDensity)
  const acousticPeak = clamp01(signal.acousticPeak)
  const opticalDepth = Math.min(2.5, Math.max(0.5, Number(signal.opticalDepth) || 1))
  const trailCanvas = document.createElement("canvas")
  trailCanvas.width = outputWidth
  trailCanvas.height = outputHeight
  const trailContext = trailCanvas.getContext("2d", {
    alpha: false,
  })
  let lastTrailCanvas: HTMLCanvasElement | null = null
  let frameCount = 0

  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }

  onStatus?.("RENDERING")
  recorder.start(250)

  await recordTimedFrames((_, progress) => {
    drawPulseIntro(context, outputWidth, outputHeight, progress, acousticPeak)
  }, pulseDurationMs)

  await seekVideo(video, startTime)
  await video.play()

  while (video.currentTime < anchorTime) {
    const distanceToAnchor = Math.max(0, anchorTime - video.currentTime)
    const continuityPulse = Math.max(0, 1 - distanceToAnchor / Math.max(0.25, anchorTime - startTime))

    drawVideoCover(context, video, outputWidth, outputHeight, opticalDepth)
    drawTrailFrame(context, lastTrailCanvas, outputWidth, outputHeight, kineticDensity)
    drawSignalPerceptionLayer(
      context,
      signal,
      outputWidth,
      outputHeight,
      continuityPulse * 0.72
    )
    drawAxisWatermark(context, outputWidth, outputHeight, continuityPulse * kineticDensity)

    if (trailContext && frameCount % Math.max(4, Math.round(10 - kineticDensity * 5)) === 0) {
      trailContext.drawImage(canvas, 0, 0, outputWidth, outputHeight)
      lastTrailCanvas = trailCanvas
    }

    frameCount += 1
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  video.pause()
  await seekVideo(video, anchorTime)

  await recordTimedFrames(() => {
    drawVideoCover(context, video, outputWidth, outputHeight, opticalDepth)
    drawTrailFrame(context, lastTrailCanvas, outputWidth, outputHeight, kineticDensity)
    drawSignalPerceptionLayer(context, signal, outputWidth, outputHeight, 1)
    drawSnapshotImageLock(context, snapshotImage, outputWidth, outputHeight, 0.2)
    drawAxisWatermark(context, outputWidth, outputHeight, kineticDensity)
  }, freezeDurationMs)

  await video.play()

  while (video.currentTime < endTime && !video.ended) {
    const tailProgress = Math.max(0, 1 - (video.currentTime - anchorTime) / Math.max(0.25, endTime - anchorTime))

    drawVideoCover(context, video, outputWidth, outputHeight, opticalDepth)
    drawTrailFrame(context, lastTrailCanvas, outputWidth, outputHeight, kineticDensity)
    drawSignalPerceptionLayer(context, signal, outputWidth, outputHeight, tailProgress * 0.5)
    drawAxisWatermark(context, outputWidth, outputHeight, tailProgress * kineticDensity)

    if (trailContext && frameCount % Math.max(4, Math.round(10 - kineticDensity * 5)) === 0) {
      trailContext.drawImage(canvas, 0, 0, outputWidth, outputHeight)
      lastTrailCanvas = trailCanvas
    }

    frameCount += 1
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  video.pause()

  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener("stop", () => resolve(), {
      once: true,
    })
  })
  recorder.stop()
  stream.getTracks().forEach((track) => track.stop())
  await stopped

  URL.revokeObjectURL(sourceUrl)

  const output = new Blob(chunks, {
    type: mimeType,
  })

  if (!output.size) {
    throw new Error("SIGNAL_EXPORT_EMPTY")
  }

  onStatus?.("PREPARING_TRANSFER")
  await shareOrDownload(output, title, mimeType)
  onStatus?.("SUCCESS")
}
