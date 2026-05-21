import type { AxisMemoryNode, AxisSessionState } from "@/store/useAxisStore"

type CameraArtifactInput = {
  memories: AxisMemoryNode[]
  session: AxisSessionState
}

const ARTIFACT_WIDTH = 1080
const ARTIFACT_HEIGHT = 1920

export function isCameraExportQuery(value: string) {
  return /\b(export|save|send)\b.*\b(camera|photos|camera roll|image|png)\b/i.test(value) || /\bsave to camera\b/i.test(value)
}

export async function exportMemoryResidueToCamera({ memories, session }: CameraArtifactInput) {
  const blob = await renderCameraArtifact({ memories, session })
  const file = new File([blob], `axis-memory-${Date.now().toString(36)}.png`, {
    type: "image/png",
  })

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({
      files: [file],
      title: "Axis memory",
    })
    return
  }

  const href = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = href
  link.download = file.name
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 1200)
}

async function renderCameraArtifact({ memories, session }: CameraArtifactInput) {
  const canvas = document.createElement("canvas")
  canvas.width = ARTIFACT_WIDTH
  canvas.height = ARTIFACT_HEIGHT

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Axis camera export unavailable")

  paintBackground(context)
  paintHeader(context, session)
  paintMemories(context, memories.slice(0, 8))
  paintFooter(context)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.94))
  if (!blob) throw new Error("Axis camera export failed")
  return blob
}

function paintBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, 0, ARTIFACT_HEIGHT)
  gradient.addColorStop(0, "#050505")
  gradient.addColorStop(0.52, "#10100e")
  gradient.addColorStop(1, "#050505")
  context.fillStyle = gradient
  context.fillRect(0, 0, ARTIFACT_WIDTH, ARTIFACT_HEIGHT)

  context.fillStyle = "rgba(255, 255, 246, 0.035)"
  context.fillRect(80, 160, ARTIFACT_WIDTH - 160, 1)
  context.fillRect(80, ARTIFACT_HEIGHT - 230, ARTIFACT_WIDTH - 160, 1)
}

function paintHeader(context: CanvasRenderingContext2D, session: AxisSessionState) {
  context.fillStyle = "rgba(255, 255, 246, 0.42)"
  context.font = "500 24px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.fillText(`${session.quarter} · ${session.score.home}-${session.score.away}`, 88, 190)

  context.fillStyle = "rgba(255, 255, 246, 0.88)"
  context.font = "520 58px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  wrapLine(context, "Axis memory", 88, 280, 880, 66)
}

function paintMemories(context: CanvasRenderingContext2D, memories: AxisMemoryNode[]) {
  const rows = memories.length ? memories : []
  let y = 500

  context.font = "500 26px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.fillStyle = "rgba(255, 255, 246, 0.32)"
  context.fillText("settled chronology", 88, y)
  y += 88

  rows.forEach((memory, index) => {
    const alpha = Math.max(0.28, 0.82 - index * 0.07)
    context.fillStyle = `rgba(255, 255, 246, ${alpha * 0.42})`
    context.font = "500 25px ui-monospace, SFMono-Regular, Menlo, monospace"
    context.fillText(memory.time, 88, y)

    context.fillStyle = `rgba(255, 255, 246, ${alpha})`
    context.font = "500 42px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    y = wrapLine(context, memory.label, 88, y + 54, 870, 50)
    y += 46
  })
}

function paintFooter(context: CanvasRenderingContext2D) {
  context.fillStyle = "rgba(255, 255, 246, 0.36)"
  context.font = "500 24px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.fillText("saved from live memory", 88, ARTIFACT_HEIGHT - 150)
}

function wrapLine(context: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = value.split(/\s+/).filter(Boolean)
  let line = ""
  let nextY = y

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, nextY)
      line = word
      nextY += lineHeight
    } else {
      line = testLine
    }
  }

  if (line) context.fillText(line, x, nextY)
  return nextY
}
