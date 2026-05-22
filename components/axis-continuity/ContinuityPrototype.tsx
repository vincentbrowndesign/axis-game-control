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
  id: string
  points: Point[]
}

type Puck = {
  bornAt: number
  id: string
  symbol: PuckSymbol
  targetX: number
  targetY: number
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
  makePuck("o1", "O", 0.42, 0.55),
  makePuck("o2", "O", 0.56, 0.4),
  makePuck("o3", "O", 0.68, 0.58),
  makePuck("o4", "O", 0.48, 0.72),
  makePuck("o5", "O", 0.78, 0.32),
  makePuck("x1", "X", 0.38, 0.42),
  makePuck("x2", "X", 0.58, 0.52),
  makePuck("x3", "X", 0.72, 0.45),
  makePuck("x4", "X", 0.52, 0.64),
  makePuck("x5", "X", 0.82, 0.54),
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
    <main className="fixed inset-0 isolate overflow-hidden bg-[#050505] text-white selection:bg-transparent touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [-webkit-user-select:none]">
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

      <nav className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-white/[0.065] p-1.5 shadow-[0_16px_42px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
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
        active ? "border-white/18 bg-white/18 text-white" : "border-transparent bg-transparent text-white/48",
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
  context.fillStyle = "#050505"
  context.fillRect(0, 0, width, height)
  drawAtmosphere(context, width, height, engine)
  drawCourt(context, width, height)
  drawStrokes(context, width, height, engine.strokes, false)
  if (engine.workingStroke) drawStrokes(context, width, height, [engine.workingStroke], true)
  drawPuckInfluence(context, width, height, engine.pucks)
  drawPucks(context, width, height, engine.pucks)
  if (engine.eraseCursor) drawEraser(context, width, height, engine.eraseCursor)

  canvas.style.cursor = engine.tool === "eraser" ? "none" : "crosshair"
}

function drawAtmosphere(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  const pressure = Math.min(1, engine.strokes.length * 0.025 + engine.pucks.length * 0.035)
  const gradient = context.createRadialGradient(width * 0.54, height * 0.45, 0, width * 0.54, height * 0.45, Math.max(width, height) * 0.72)
  gradient.addColorStop(0, `rgba(255,255,255,${0.04 + pressure * 0.03})`)
  gradient.addColorStop(0.55, "rgba(255,255,255,0.012)")
  gradient.addColorStop(1, "rgba(0,0,0,0)")
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
}

function drawCourt(context: CanvasRenderingContext2D, width: number, height: number) {
  const margin = Math.round(Math.min(width, height) * 0.065)
  const x = margin
  const y = margin
  const courtWidth = width - margin * 2
  const courtHeight = height - margin * 2
  const centerX = x + courtWidth / 2
  const centerY = y + courtHeight / 2
  const line = Math.max(1, Math.round(Math.min(width, height) * 0.0016))

  context.save()
  context.strokeStyle = "rgba(255,255,255,0.08)"
  context.lineWidth = line
  context.lineCap = "round"
  context.lineJoin = "round"
  context.strokeRect(round(x), round(y), round(courtWidth), round(courtHeight))
  linePath(context, [
    [centerX, y],
    [centerX, y + courtHeight],
  ])
  circle(context, centerX, centerY, courtHeight * 0.12)

  const keyWidth = courtWidth * 0.16
  const keyHeight = courtHeight * 0.36
  context.strokeRect(round(x), round(centerY - keyHeight / 2), round(keyWidth), round(keyHeight))
  context.strokeRect(round(x + courtWidth - keyWidth), round(centerY - keyHeight / 2), round(keyWidth), round(keyHeight))
  circle(context, x + keyWidth, centerY, courtHeight * 0.12)
  circle(context, x + courtWidth - keyWidth, centerY, courtHeight * 0.12)

  const hoopInset = courtWidth * 0.075
  linePath(context, [
    [x + hoopInset * 0.68, centerY - courtHeight * 0.07],
    [x + hoopInset * 0.68, centerY + courtHeight * 0.07],
  ])
  linePath(context, [
    [x + courtWidth - hoopInset * 0.68, centerY - courtHeight * 0.07],
    [x + courtWidth - hoopInset * 0.68, centerY + courtHeight * 0.07],
  ])
  circle(context, x + hoopInset, centerY, courtHeight * 0.025)
  circle(context, x + courtWidth - hoopInset, centerY, courtHeight * 0.025)

  context.strokeStyle = "rgba(255,255,255,0.04)"
  context.lineWidth = Math.max(1, line * 0.8)
  arc(context, x + hoopInset, centerY, courtHeight * 0.41, -Math.PI / 2, Math.PI / 2)
  arc(context, x + courtWidth - hoopInset, centerY, courtHeight * 0.41, Math.PI / 2, Math.PI * 1.5)
  linePath(context, [
    [x + courtWidth * 0.18, y + courtHeight * 0.22],
    [x + courtWidth * 0.42, y + courtHeight * 0.34],
    [x + courtWidth * 0.58, y + courtHeight * 0.34],
    [x + courtWidth * 0.82, y + courtHeight * 0.22],
  ])
  linePath(context, [
    [x + courtWidth * 0.18, y + courtHeight * 0.78],
    [x + courtWidth * 0.42, y + courtHeight * 0.66],
    [x + courtWidth * 0.58, y + courtHeight * 0.66],
    [x + courtWidth * 0.82, y + courtHeight * 0.78],
  ])
  context.restore()
}

function drawStrokes(context: CanvasRenderingContext2D, width: number, height: number, strokes: Stroke[], active: boolean) {
  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"
  context.strokeStyle = active ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.66)"

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue
    context.beginPath()
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

    context.fillStyle = symbolFill(puck.symbol)
    context.font = `650 ${Math.round(radius * 0.62)}px ui-sans-serif, system-ui`
    context.fillText(puck.symbol, point.x, point.y + radius * 0.015)
    context.restore()
  }
  context.restore()
}

function drawEraser(context: CanvasRenderingContext2D, width: number, height: number, point: Point) {
  const pixel = toPixels(point, width, height)
  context.save()
  context.strokeStyle = "rgba(255,255,255,0.34)"
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

  for (const puck of engine.pucks) {
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
  return { bornAt: -10000, id, symbol, targetX: x, targetY: y, vx: 0, vy: 0, x, y }
}

function clonePucks(pucks: Puck[]) {
  return pucks.map((puck) => ({ ...puck }))
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

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function puckFill(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(206,199,185,0.76)"
  return "rgba(47,48,49,0.82)"
}

function puckCoreFill(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(242,235,218,0.78)"
  return "rgba(83,84,84,0.78)"
}

function puckEdgeFill(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(126,119,105,0.54)"
  return "rgba(20,21,22,0.82)"
}

function symbolStroke(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(255,248,231,0.16)"
  return "rgba(210,212,210,0.1)"
}

function symbolGlow(symbol: PuckSymbol, alpha: number) {
  if (symbol === "O") return `rgba(238,230,212,${alpha})`
  return `rgba(155,158,156,${alpha * 0.46})`
}

function symbolFill(symbol: PuckSymbol) {
  if (symbol === "O") return "rgba(35,33,29,0.72)"
  return "rgba(220,222,218,0.54)"
}
