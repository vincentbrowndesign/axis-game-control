"use client"

import { Eraser, Pencil, RotateCcw, Trash2 } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

type Tool = "pencil" | "eraser"
type PuckSymbol = "O" | "X"

type Point = {
  pressure: number
  t: number
  x: number
  y: number
}

type Stroke = {
  createdAt: number
  id: string
  points: Point[]
}

type TrailPoint = {
  t: number
  x: number
  y: number
}

type Puck = {
  baseX: number
  baseY: number
  bornAt: number
  id: string
  symbol: PuckSymbol
  targetX: number
  targetY: number
  trail: TrailPoint[]
  vx: number
  vy: number
  x: number
  y: number
}

type Engine = {
  activePointerId: number | null
  activePointerType: string | null
  draggingPuckId: string | null
  drawing: boolean
  eraseCursor: Point | null
  moved: boolean
  penActiveUntil: number
  pucks: Puck[]
  rafId: number
  rect: DOMRect | null
  strokeSequence: number
  strokes: Stroke[]
  tool: Tool
  workingStroke: Stroke | null
}

const initialPucks: Puck[] = [
  makePuck("o1", "O", 0.5, 0.2),
  makePuck("o2", "O", 0.28, 0.4),
  makePuck("o3", "O", 0.72, 0.4),
  makePuck("o4", "O", 0.38, 0.68),
  makePuck("o5", "O", 0.62, 0.68),
  makePuck("x1", "X", 0.5, 0.31),
  makePuck("x2", "X", 0.32, 0.5),
  makePuck("x3", "X", 0.68, 0.5),
  makePuck("x4", "X", 0.42, 0.78),
  makePuck("x5", "X", 0.58, 0.78),
]

export function ContinuityPrototype() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const [tool, setTool] = useState<Tool>("pencil")

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasElement: HTMLCanvasElement = canvas

    const canvasContext = canvasElement.getContext("2d", { alpha: false })
    if (!canvasContext) return
    const context: CanvasRenderingContext2D = canvasContext

    const engine: Engine = {
      activePointerId: null,
      activePointerType: null,
      draggingPuckId: null,
      drawing: false,
      eraseCursor: null,
      moved: false,
      penActiveUntil: 0,
      pucks: clonePucks(initialPucks),
      rafId: 0,
      rect: null,
      strokeSequence: 0,
      strokes: [],
      tool: "pencil",
      workingStroke: null,
    }
    engineRef.current = engine

    function resize() {
      const rect = canvasElement.getBoundingClientRect()
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      engine.rect = rect
      canvasElement.width = Math.round(rect.width * dpr)
      canvasElement.height = Math.round(rect.height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function frame() {
      updatePhysics(engine)
      render(context, engine, canvasElement)
      engine.rafId = window.requestAnimationFrame(frame)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvasElement)
    resize()
    frame()

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(engine.rafId)
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.tool = tool
    }
  }, [tool])

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const engine = engineRef.current
    if (!engine) return
    event.preventDefault()

    if (event.pointerType === "pen") {
      engine.penActiveUntil = performance.now() + 900
    }

    if (event.pointerType === "touch" && performance.now() < engine.penActiveUntil) return
    if (engine.activePointerId !== null && event.pointerType === "touch") return

    const point = eventPoint(event, engine)
    if (!point) return

    const puck = findPuckAt(engine, point)
    engine.activePointerId = event.pointerId
    engine.activePointerType = event.pointerType
    engine.moved = false
    event.currentTarget.setPointerCapture(event.pointerId)

    if (puck) {
      engine.draggingPuckId = puck.id
      puck.targetX = point.x
      puck.targetY = point.y
      return
    }

    if (engine.tool === "eraser") {
      engine.eraseCursor = point
      eraseAt(engine, point)
      return
    }

    if (!canCreateStroke(event.pointerType)) return

    engine.drawing = true
    engine.workingStroke = {
      createdAt: performance.now(),
      id: `stroke-${engine.strokeSequence + 1}`,
      points: [point],
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const engine = engineRef.current
    if (!engine || engine.activePointerId !== event.pointerId) return
    event.preventDefault()

    const point = eventPoint(event, engine)
    if (!point) return

    engine.moved = true

    if (engine.draggingPuckId) {
      engine.moved = true
      const puck = engine.pucks.find((item) => item.id === engine.draggingPuckId)
      if (puck) {
        puck.baseX = point.x
        puck.baseY = point.y
        puck.targetX = point.x
        puck.targetY = point.y
      }
      return
    }

    if (engine.tool === "eraser") {
      engine.eraseCursor = point
      eraseAt(engine, point)
      return
    }

    if (engine.drawing && engine.workingStroke) {
      const previous = engine.workingStroke.points.at(-1)
      if (!previous || distance(previous, point) > 0.003) {
        engine.moved = true
        engine.workingStroke.points.push(point)
      }
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const engine = engineRef.current
    if (!engine || engine.activePointerId !== event.pointerId) return
    event.preventDefault()

    event.currentTarget.releasePointerCapture(event.pointerId)

    if (engine.drawing && engine.workingStroke) {
      if (engine.workingStroke.points.length > 2) {
        engine.strokeSequence += 1
        engine.strokes.push(engine.workingStroke)
      }
      engine.workingStroke = null
    }

    engine.activePointerId = null
    engine.activePointerType = null
    engine.draggingPuckId = null
    engine.drawing = false
    engine.eraseCursor = null
  }

  function undo() {
    const engine = engineRef.current
    if (!engine) return

    if (engine.strokes.length > 0) {
      engine.strokes.pop()
    }
  }

  function clear() {
    const engine = engineRef.current
    if (!engine) return

    engine.strokes = []
    engine.workingStroke = null
  }

  return (
    <main className="fixed inset-0 isolate overflow-hidden bg-[#f8f5ec] text-black selection:bg-transparent touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [-webkit-user-select:none]">
      <canvas
        aria-label="Axis tactical canvas"
        className="absolute inset-0 h-full w-full touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [-webkit-user-select:none]"
        onContextMenu={(event) => event.preventDefault()}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={canvasRef}
      />

      <nav className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-black/10 bg-white/45 p-1.5 shadow-[0_16px_42px_rgba(41,32,18,0.12)] backdrop-blur-2xl">
        <ToolbarButton active={tool === "pencil"} label="Pencil" onClick={() => setTool("pencil")}>
          <Pencil aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton active={tool === "eraser"} label="Eraser" onClick={() => setTool("eraser")}>
          <Eraser aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Undo" onClick={undo}>
          <RotateCcw aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Clear" onClick={clear}>
          <Trash2 aria-hidden="true" />
        </ToolbarButton>
      </nav>
    </main>
  )
}

function ToolbarButton({
  active = false,
  children,
  label,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className={[
        "grid h-11 w-11 place-items-center rounded-full border transition-colors",
        active ? "border-black/14 bg-black text-[#f8f5ec]" : "border-transparent bg-transparent text-black/44",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <span className="[&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[1.8]">{children}</span>
    </button>
  )
}

function render(context: CanvasRenderingContext2D, engine: Engine, canvas: HTMLCanvasElement) {
  const rect = engine.rect
  if (!rect) return

  const width = rect.width
  const height = rect.height
  context.fillStyle = "#f8f5ec"
  context.fillRect(0, 0, width, height)
  drawAtmosphere(context, width, height, engine)
  drawCourt(context, width, height)
  drawTemporalTrails(context, width, height, engine.pucks)
  drawStrokes(context, width, height, engine.strokes, false)
  if (engine.workingStroke) drawStrokes(context, width, height, [engine.workingStroke], true)
  drawMovementIntent(context, width, height, engine)
  drawPuckInfluence(context, width, height, engine.pucks)
  drawPucks(context, width, height, engine.pucks)
  if (engine.eraseCursor) drawEraser(context, width, height, engine.eraseCursor)

  canvas.style.cursor = engine.tool === "eraser" ? "none" : "crosshair"
}

function drawAtmosphere(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  const pressure = Math.min(1, engine.strokes.length * 0.025 + engine.pucks.length * 0.035)
  const gradient = context.createRadialGradient(width * 0.54, height * 0.45, 0, width * 0.54, height * 0.45, Math.max(width, height) * 0.72)
  gradient.addColorStop(0, `rgba(0,0,0,${0.018 + pressure * 0.012})`)
  gradient.addColorStop(0.58, "rgba(82,67,42,0.012)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
}

function drawCourt(context: CanvasRenderingContext2D, width: number, height: number) {
  const margin = Math.round(Math.min(width, height) * 0.075)
  const courtHeight = height - margin * 2
  const courtWidth = Math.min(width - margin * 2, courtHeight * 1.2)
  const x = (width - courtWidth) / 2
  const y = margin
  const centerX = x + courtWidth / 2
  const baselineY = y + courtHeight
  const hoopY = y + courtHeight * 0.78
  const line = Math.max(1, Math.round(Math.min(width, height) * 0.00125))

  context.save()
  context.strokeStyle = "rgba(8,8,7,0.18)"
  context.lineWidth = Math.max(1, line)
  context.lineCap = "round"
  context.lineJoin = "round"
  context.strokeRect(round(x), round(y), round(courtWidth), round(courtHeight))

  linePath(context, [
    [x, y + courtHeight * 0.08],
    [x + courtWidth, y + courtHeight * 0.08],
  ])
  circle(context, centerX, y + courtHeight * 0.08, courtWidth * 0.115)

  const keyWidth = courtWidth * 0.32
  const keyHeight = courtHeight * 0.32
  const keyX = centerX - keyWidth / 2
  const keyY = baselineY - keyHeight
  context.strokeRect(round(keyX), round(keyY), round(keyWidth), round(keyHeight))
  circle(context, centerX, keyY, keyWidth * 0.29)

  const hoopRadius = courtWidth * 0.025
  linePath(context, [
    [centerX - courtWidth * 0.07, hoopY + courtHeight * 0.01],
    [centerX + courtWidth * 0.07, hoopY + courtHeight * 0.01],
  ])
  circle(context, centerX, hoopY, hoopRadius)

  context.strokeStyle = "rgba(8,8,7,0.1)"
  context.lineWidth = Math.max(1, line * 0.9)
  arc(context, centerX, hoopY, courtWidth * 0.43, Math.PI * 1.08, Math.PI * 1.92)
  arc(context, centerX, hoopY, courtWidth * 0.16, Math.PI * 1.08, Math.PI * 1.92)
  context.restore()
}

function drawStrokes(context: CanvasRenderingContext2D, width: number, height: number, strokes: Stroke[], active: boolean) {
  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue
    const age = performance.now() - stroke.createdAt
    const alpha = active ? 0.72 : 0.56 * strokeFade(age)
    if (alpha <= 0.01) continue

    context.beginPath()
    context.strokeStyle = `rgba(8,8,7,${alpha})`
    const first = toPixels(stroke.points[0], width, height)
    context.moveTo(first.x, first.y)
    for (let index = 1; index < stroke.points.length - 1; index += 1) {
      const source = stroke.points[index]
      const current = toPixels(stroke.points[index], width, height)
      const next = toPixels(stroke.points[index + 1], width, height)
      const midX = (current.x + next.x) / 2
      const midY = (current.y + next.y) / 2
      context.lineWidth = Math.max(1.5, 4.2 * (0.46 + source.pressure * 0.54))
      context.quadraticCurveTo(current.x, current.y, midX, midY)
    }
    context.stroke()
  }
  context.restore()
}

function drawTemporalTrails(context: CanvasRenderingContext2D, width: number, height: number, pucks: Puck[]) {
  const now = performance.now()
  context.save()

  for (const puck of pucks) {
    if (puck.trail.length < 2) continue

    for (let index = 1; index < puck.trail.length; index += 1) {
      const previous = puck.trail[index - 1]
      const current = puck.trail[index]
      const age = now - current.t
      const alpha = clamp(1 - age / 2200, 0, 1) * (puck.symbol === "O" ? 0.09 : 0.055)
      if (alpha <= 0.004) continue

      const start = toPixels(previous, width, height)
      const end = toPixels(current, width, height)
      context.strokeStyle = puck.symbol === "O" ? `rgba(8,8,7,${alpha})` : `rgba(8,8,7,${alpha * 0.72})`
      context.lineWidth = Math.max(1, Math.min(width, height) * 0.0022 * alpha * 8)
      context.lineCap = "round"
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()
    }
  }

  context.restore()
}

function drawMovementIntent(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"

  for (const puck of engine.pucks) {
    const movement = Math.hypot(puck.targetX - puck.baseX, puck.targetY - puck.baseY)
    if (movement < 0.014) continue

    const start = toPixels({ x: puck.baseX, y: puck.baseY }, width, height)
    const end = toPixels({ x: puck.targetX, y: puck.targetY }, width, height)
    const lift = Math.min(width, height) * 0.018
    const controlX = (start.x + end.x) / 2
    const controlY = (start.y + end.y) / 2 - lift

    context.strokeStyle = puck.symbol === "O" ? "rgba(8,8,7,0.13)" : "rgba(8,8,7,0.08)"
    context.lineWidth = Math.max(1, Math.min(width, height) * 0.0014)
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.quadraticCurveTo(controlX, controlY, end.x, end.y)
    context.stroke()
  }

  context.restore()
}

function drawPuckInfluence(context: CanvasRenderingContext2D, width: number, height: number, pucks: Puck[]) {
  context.save()
  for (const puck of pucks) {
    const point = toPixels(puck, width, height)
    const radius = puckRadius(width, height)
    const birth = puckBirthProgress(puck)
    if (birth <= 0) continue
    const pulse = (Math.sin(performance.now() / 850 + puck.x * 8) + 1) / 2
    const catchLight = 1 + (1 - birth) * 0.45
    const gradient = context.createRadialGradient(point.x, point.y, radius * 0.18, point.x, point.y, radius * (1.54 + pulse * 0.16 + (1 - birth) * 0.22))
    gradient.addColorStop(0, symbolGlow(puck.symbol, 0.052 * catchLight))
    gradient.addColorStop(0.52, symbolGlow(puck.symbol, 0.019 * catchLight))
    gradient.addColorStop(1, symbolGlow(puck.symbol, 0))
    context.fillStyle = gradient
    context.beginPath()
    context.arc(point.x, point.y, radius * (1.68 + pulse * 0.08), 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

function drawPucks(context: CanvasRenderingContext2D, width: number, height: number, pucks: Puck[]) {
  context.save()
  context.textAlign = "center"
  context.textBaseline = "middle"

  for (const puck of pucks) {
    const point = toPixels(puck, width, height)
    const birth = puckBirthProgress(puck)
    const radius = puckRadius(width, height) * (0.85 + birth * 0.15)
    context.save()
    context.globalAlpha = 0.88 * birth
    context.shadowBlur = 8 + (1 - birth) * 7
    context.shadowColor = "rgba(0,0,0,0.24)"
    const body = context.createRadialGradient(point.x - radius * 0.2, point.y - radius * 0.28, radius * 0.08, point.x, point.y, radius)
    body.addColorStop(0, puckCoreFill(puck.symbol))
    body.addColorStop(0.46, puckFill(puck.symbol))
    body.addColorStop(1, puckEdgeFill(puck.symbol))
    context.fillStyle = body
    context.beginPath()
    context.arc(point.x, point.y, radius, 0, Math.PI * 2)
    context.fill()
    context.shadowBlur = 0
    context.strokeStyle = symbolStroke(puck.symbol)
    context.lineWidth = Math.max(1, radius * 0.044)
    context.stroke()

    drawSymbolMark(context, puck.symbol, point.x, point.y, radius)
    context.restore()
  }
  context.restore()
}

function drawSymbolMark(context: CanvasRenderingContext2D, symbol: PuckSymbol, x: number, y: number, radius: number) {
  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"

  if (symbol === "O") {
    context.strokeStyle = "rgba(20,18,15,0.68)"
    context.lineWidth = Math.max(2, radius * 0.13)
    context.beginPath()
    context.arc(x, y, radius * 0.38, 0, Math.PI * 2)
    context.stroke()
  } else {
    context.strokeStyle = "rgba(238,235,226,0.74)"
    context.lineWidth = Math.max(2, radius * 0.12)
    const inset = radius * 0.33
    context.beginPath()
    context.moveTo(x - inset, y - inset)
    context.lineTo(x + inset, y + inset)
    context.moveTo(x + inset, y - inset)
    context.lineTo(x - inset, y + inset)
    context.stroke()
  }

  context.restore()
}

function drawEraser(context: CanvasRenderingContext2D, width: number, height: number, point: Point) {
  const pixel = toPixels(point, width, height)
  context.save()
  context.strokeStyle = "rgba(8,8,7,0.34)"
  context.lineWidth = 1
  context.beginPath()
  context.arc(pixel.x, pixel.y, Math.min(width, height) * 0.036, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

function updatePhysics(engine: Engine) {
  const spring = 0.18
  const damping = 0.76
  const settle = 0.00006

  pruneTemporalMemory(engine)
  applyBasketballRelationships(engine)

  for (const puck of engine.pucks) {
    const previousX = puck.x
    const previousY = puck.y
    puck.vx += (puck.targetX - puck.x) * spring
    puck.vy += (puck.targetY - puck.y) * spring
    puck.vx *= damping
    puck.vy *= damping
    puck.x += puck.vx
    puck.y += puck.vy
    if (Math.abs(puck.vx) < settle) puck.vx = 0
    if (Math.abs(puck.vy) < settle) puck.vy = 0
    puck.x = clamp(puck.x, 0.04, 0.96)
    puck.y = clamp(puck.y, 0.06, 0.94)
    puck.targetX = clamp(puck.targetX, 0.04, 0.96)
    puck.targetY = clamp(puck.targetY, 0.06, 0.94)
    captureTrailPoint(puck, previousX, previousY)
  }
}

function pruneTemporalMemory(engine: Engine) {
  const now = performance.now()
  engine.strokes = engine.strokes.filter((stroke) => strokeFade(now - stroke.createdAt) > 0.015)

  for (const puck of engine.pucks) {
    puck.trail = puck.trail.filter((point) => now - point.t < 2200)
  }
}

function captureTrailPoint(puck: Puck, previousX: number, previousY: number) {
  const moved = Math.hypot(puck.x - previousX, puck.y - previousY)
  if (moved < 0.0014) return

  const last = puck.trail.at(-1)
  const now = performance.now()
  if (last && now - last.t < 70 && distance(last, puck) < 0.012) return

  puck.trail.push({ t: now, x: puck.x, y: puck.y })
  if (puck.trail.length > 32) {
    puck.trail.shift()
  }
}

function applyBasketballRelationships(engine: Engine) {
  const latestStroke = engine.workingStroke ?? engine.strokes.at(-1) ?? null

  for (const puck of engine.pucks) {
    if (puck.id === engine.draggingPuckId) continue

    let desiredX = puck.baseX
    let desiredY = puck.baseY

    if (puck.symbol === "X") {
      const nearestO = nearestPuck(puck, engine.pucks, "O")
      if (nearestO) {
        const proximity = clamp(1 - distance(puck, nearestO) / 0.34, 0, 1)
        desiredX += (nearestO.x - puck.baseX) * 0.1 * proximity
        desiredY += (nearestO.y - puck.baseY) * 0.1 * proximity
      }

      const ballSide = averagePuck(engine.pucks, "O")
      if (ballSide) {
        desiredX += (ballSide.x - 0.5) * 0.035
        desiredY += (ballSide.y - puck.baseY) * 0.025
      }
    } else {
      for (const teammate of engine.pucks) {
        if (teammate.id === puck.id || teammate.symbol !== "O") continue
        const gap = distance(puck, teammate)
        if (gap > 0 && gap < 0.18) {
          desiredX += ((puck.x - teammate.x) / gap) * (0.18 - gap) * 0.09
          desiredY += ((puck.y - teammate.y) / gap) * (0.18 - gap) * 0.09
        }
      }

      const nearestX = nearestPuck(puck, engine.pucks, "X")
      if (nearestX) {
        const pressure = clamp(1 - distance(puck, nearestX) / 0.22, 0, 1)
        desiredX += (puck.x - nearestX.x) * 0.055 * pressure
        desiredY += (puck.y - nearestX.y) * 0.055 * pressure
      }

      const strokeIntent = strokeVectorInfluence(puck, latestStroke)
      if (strokeIntent) {
        desiredX += strokeIntent.x
        desiredY += strokeIntent.y
      }
    }

    puck.targetX = clamp(desiredX, 0.04, 0.96)
    puck.targetY = clamp(desiredY, 0.06, 0.94)
  }
}

function nearestPuck(origin: Puck, pucks: Puck[], symbol: PuckSymbol) {
  let nearest: Puck | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const puck of pucks) {
    if (puck.id === origin.id || puck.symbol !== symbol) continue
    const gap = distance(origin, puck)
    if (gap < nearestDistance) {
      nearest = puck
      nearestDistance = gap
    }
  }

  return nearest
}

function averagePuck(pucks: Puck[], symbol: PuckSymbol) {
  const matching = pucks.filter((puck) => puck.symbol === symbol)
  if (matching.length === 0) return null

  return {
    x: matching.reduce((sum, puck) => sum + puck.x, 0) / matching.length,
    y: matching.reduce((sum, puck) => sum + puck.y, 0) / matching.length,
  }
}

function strokeVectorInfluence(puck: Puck, stroke: Stroke | null) {
  if (!stroke || stroke.points.length < 6) return null

  const start = stroke.points[0]
  const end = stroke.points[stroke.points.length - 1]
  const distanceToStart = distance(puck, start)
  const weight = clamp(1 - distanceToStart / 0.2, 0, 1)
  if (weight <= 0) return null

  return {
    x: (end.x - start.x) * 0.08 * weight,
    y: (end.y - start.y) * 0.08 * weight,
  }
}

function eventPoint(event: ReactPointerEvent<HTMLCanvasElement>, engine: Engine): Point | null {
  const rect = engine.rect
  if (!rect) return null

  return {
    pressure: event.pressure || 0.5,
    t: event.timeStamp,
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  }
}

function findPuckAt(engine: Engine, point: Point) {
  const rect = engine.rect
  if (!rect) return null

  const radius = puckRadius(rect.width, rect.height) / Math.min(rect.width, rect.height)
  for (let index = engine.pucks.length - 1; index >= 0; index -= 1) {
    const puck = engine.pucks[index]
    if (distance(puck, point) < radius * 1.45) return puck
  }
  return null
}

function eraseAt(engine: Engine, point: Point) {
  const threshold = 0.035
  engine.strokes = engine.strokes
    .map((stroke) => ({
      ...stroke,
      points: stroke.points.filter((strokePoint) => distance(strokePoint, point) > threshold),
    }))
    .filter((stroke) => stroke.points.length > 1)
}

function canCreateStroke(pointerType: string) {
  return pointerType === "pen" || pointerType === "mouse"
}

function makePuck(id: string, symbol: PuckSymbol, x: number, y: number): Puck {
  return { baseX: x, baseY: y, bornAt: -10000, id, symbol, targetX: x, targetY: y, trail: [], vx: 0, vy: 0, x, y }
}

function clonePucks(pucks: Puck[]) {
  return pucks.map((puck) => ({ ...puck, trail: [] }))
}

function toPixels(point: { x: number; y: number }, width: number, height: number) {
  return {
    x: point.x * width,
    y: point.y * height,
  }
}

function puckRadius(width: number, height: number) {
  return Math.max(19, Math.min(width, height) * 0.0385)
}

function linePath(context: CanvasRenderingContext2D, points: Array<[number, number]>) {
  context.beginPath()
  context.moveTo(round(points[0][0]), round(points[0][1]))
  for (const point of points.slice(1)) {
    context.lineTo(round(point[0]), round(point[1]))
  }
  context.stroke()
}

function circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath()
  context.arc(round(x), round(y), round(radius), 0, Math.PI * 2)
  context.stroke()
}

function arc(context: CanvasRenderingContext2D, x: number, y: number, radius: number, start: number, end: number) {
  context.beginPath()
  context.arc(round(x), round(y), round(radius), start, end)
  context.stroke()
}

function round(value: number) {
  return Math.round(value)
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function puckBirthProgress(puck: Puck) {
  if (puck.bornAt < 0) return 1
  return easeOutCubic(clamp((performance.now() - puck.bornAt) / 320, 0, 1))
}

function strokeFade(age: number) {
  return clamp(1 - age / 7200, 0, 1) ** 1.7
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function puckFill(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(238,234,222,0.88)"
  return "rgba(42,42,41,0.9)"
}

function puckCoreFill(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(255,252,241,0.92)"
  return "rgba(88,88,86,0.86)"
}

function puckEdgeFill(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(176,167,146,0.64)"
  return "rgba(18,18,18,0.88)"
}

function symbolStroke(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(0,0,0,0.14)"
  return "rgba(0,0,0,0.24)"
}

function symbolGlow(symbol: PuckSymbol, alpha: number) {
  if (symbol === "O") return `rgba(48,42,31,${alpha * 0.46})`
  return `rgba(0,0,0,${alpha * 0.58})`
}
