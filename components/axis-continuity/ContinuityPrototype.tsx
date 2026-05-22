"use client"

import { motion, type PanInfo } from "framer-motion"
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

type Tool = "move" | "draw" | "erase" | "spot"
type ResultType = "make" | "miss" | "turnover" | "collapse" | "assist" | "help late"
type PackageMode = "Scout" | "Practice" | "Teaching" | "Player Dev"

type CourtPoint = {
  x: number
  y: number
}

type PlayerToken = CourtPoint & {
  id: string
  name: string
  number: string
  role: string
}

type ActionStroke = {
  id: string
  points: CourtPoint[]
}

type SpotEvent = CourtPoint & {
  id: string
  playerId: string
  result: ResultType
  timestamp: string
}

const initialPlayers: PlayerToken[] = [
  { id: "jalen", name: "Jalen", number: "5", role: "PG", x: 44, y: 52 },
  { id: "carter", name: "Carter", number: "12", role: "Wing", x: 64, y: 35 },
  { id: "miles", name: "Miles", number: "23", role: "Big", x: 76, y: 51 },
  { id: "nico", name: "Nico", number: "2", role: "Slot", x: 55, y: 70 },
  { id: "wings", name: "Wings", number: "", role: "Group", x: 83, y: 23 },
]

const resultTypes: ResultType[] = ["make", "miss", "turnover", "collapse", "assist", "help late"]
const packageModes: PackageMode[] = ["Scout", "Practice", "Teaching", "Player Dev"]
const baselineTicker = [
  "Weak-side help arriving late",
  "Corner touch increasing paint collapse",
  "Recovery lineup stabilizing",
  "Slot pressure creating skip lane",
]

export function ContinuityPrototype() {
  const courtRef = useRef<HTMLDivElement | null>(null)
  const nextIdRef = useRef(0)
  const [players, setPlayers] = useState(initialPlayers)
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayers[0].id)
  const [tool, setTool] = useState<Tool>("move")
  const [strokes, setStrokes] = useState<ActionStroke[]>([])
  const [draftStroke, setDraftStroke] = useState<ActionStroke | null>(null)
  const [pendingSpot, setPendingSpot] = useState<CourtPoint | null>(null)
  const [events, setEvents] = useState<SpotEvent[]>([])
  const [packageMode, setPackageMode] = useState<PackageMode>("Practice")
  const [packageEventIds, setPackageEventIds] = useState<string[]>([])

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? players[0]
  const tickerItems = useMemo(() => buildTicker(events, players), [events, players])
  const packageEvents = packageEventIds.map((id) => events.find((event) => event.id === id)).filter((event): event is SpotEvent => Boolean(event))
  const continuityPressure = Math.min(1, events.length * 0.09 + strokes.length * 0.045 + packageEvents.length * 0.12)

  function updatePlayer(id: string, update: Partial<PlayerToken>) {
    setPlayers((current) => current.map((player) => (player.id === id ? { ...player, ...update } : player)))
  }

  function nextId(prefix: string) {
    nextIdRef.current += 1
    return `${prefix}-${nextIdRef.current}`
  }

  function movePlayer(id: string, info: PanInfo) {
    const point = pointFromPage(info.point.x, info.point.y)
    if (!point) return
    updatePlayer(id, point)
  }

  function startCourtAction(event: ReactPointerEvent<SVGSVGElement>) {
    const point = pointFromEvent(event)
    if (!point) return

    if (tool === "draw") {
      event.currentTarget.setPointerCapture(event.pointerId)
      setDraftStroke({ id: nextId("stroke"), points: [point] })
      return
    }

    if (tool === "erase") {
      eraseNear(point)
      return
    }

    if (tool === "spot") {
      setPendingSpot(point)
    }
  }

  function moveCourtAction(event: ReactPointerEvent<SVGSVGElement>) {
    const point = pointFromEvent(event)
    if (!point) return

    if (tool === "draw" && draftStroke) {
      setDraftStroke((current) => (current ? { ...current, points: [...current.points, point] } : current))
      return
    }

    if (tool === "erase") {
      eraseNear(point)
    }
  }

  function finishCourtAction(event: ReactPointerEvent<SVGSVGElement>) {
    if (tool !== "draw" || !draftStroke) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    if (draftStroke.points.length > 1) {
      setStrokes((current) => [...current, draftStroke].slice(-18))
    }
    setDraftStroke(null)
  }

  function addResult(result: ResultType) {
    if (!pendingSpot || !selectedPlayer) return

    const nextEvent: SpotEvent = {
      ...pendingSpot,
      id: nextId("event"),
      playerId: selectedPlayer.id,
      result,
      timestamp: `${String(events.length + 1).padStart(2, "0")}`,
    }

    setEvents((current) => [...current, nextEvent].slice(-24))
    setPackageEventIds((current) => [...current, nextEvent.id])
    setPendingSpot(null)
    setTool("move")
  }

  function togglePackageEvent(id: string) {
    setPackageEventIds((current) => (current.includes(id) ? current.filter((eventId) => eventId !== id) : [...current, id]))
  }

  function eraseNear(point: CourtPoint) {
    setStrokes((current) =>
      current.filter((stroke) => {
        const nearest = stroke.points.some((strokePoint) => distance(strokePoint, point) < 4.8)
        return !nearest
      }),
    )
  }

  function pointFromEvent(event: ReactPointerEvent<SVGSVGElement>) {
    return pointFromPage(event.clientX, event.clientY)
  }

  function pointFromPage(clientX: number, clientY: number): CourtPoint | null {
    const rect = courtRef.current?.getBoundingClientRect()
    if (!rect) return null

    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 3, 97),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 4, 96),
    }
  }

  return (
    <main className="fixed inset-0 isolate flex h-dvh flex-col overflow-hidden bg-[#fbf8ef] text-black selection:bg-black/10">
      <SurfaceMemory pressure={continuityPressure} />

      <header className="relative z-20 flex min-h-16 items-center justify-between px-4 pt-[max(0.9rem,env(safe-area-inset-top))] md:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-black text-[0.68rem] font-black tracking-[-0.04em]">A</span>
          <div className="grid">
            <span className="text-[0.64rem] font-black uppercase tracking-[0.2em] text-black/70">Axis Board</span>
            <span className="text-xs font-medium text-black/42">live coaching surface</span>
          </div>
        </div>
        <TacticalTicker items={tickerItems} />
      </header>

      <section className="relative z-10 grid min-h-0 flex-1 place-items-center px-3 py-2 md:px-7">
        <div ref={courtRef} className="relative aspect-[1.72/1] w-full max-w-6xl overflow-hidden rounded-[1.3rem] border-[2.5px] border-black bg-[#fffdf7] shadow-[0_22px_64px_rgba(62,48,24,0.14),inset_0_1px_0_rgba(255,255,255,0.92)]">
          <CourtGeometry pressure={continuityPressure} />
          <DrawingSurface
            draftStroke={draftStroke}
            events={events}
            pendingSpot={pendingSpot}
            players={players}
            strokes={strokes}
            tool={tool}
            onPointerDown={startCourtAction}
            onPointerMove={moveCourtAction}
            onPointerUp={finishCourtAction}
          />

          {players.map((player) => (
            <PlayerMagnet
              key={player.id}
              player={player}
              selected={player.id === selectedPlayerId}
              onDragEnd={(info) => movePlayer(player.id, info)}
              onSelect={() => {
                setSelectedPlayerId(player.id)
                setTool("move")
              }}
              onUpdate={(update) => updatePlayer(player.id, update)}
            />
          ))}

          <ResultPicker pendingSpot={pendingSpot} player={selectedPlayer} onCancel={() => setPendingSpot(null)} onResult={addResult} />
        </div>
      </section>

      <section className="relative z-20 px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))] md:px-7">
        <BoardDock
          events={events}
          packageEventIds={packageEventIds}
          packageEvents={packageEvents}
          packageMode={packageMode}
          selectedPlayer={selectedPlayer}
          setPackageMode={setPackageMode}
          setTool={setTool}
          tool={tool}
          togglePackageEvent={togglePackageEvent}
          wipe={() => {
            setDraftStroke(null)
            setStrokes([])
          }}
        />
      </section>
    </main>
  )
}

function PlayerMagnet({
  onDragEnd,
  onSelect,
  onUpdate,
  player,
  selected,
}: {
  onDragEnd: (info: PanInfo) => void
  onSelect: () => void
  onUpdate: (update: Partial<PlayerToken>) => void
  player: PlayerToken
  selected: boolean
}) {
  return (
    <motion.div
      animate={{ opacity: selected ? 1 : 0.86, scale: selected ? 1.02 : 1 }}
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      drag
      dragElastic={0.08}
      dragMomentum={false}
      onDragEnd={(_, info) => onDragEnd(info)}
      onPointerDown={onSelect}
      style={{ left: `${player.x}%`, top: `${player.y}%` }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        className={[
          "grid min-w-[5.5rem] touch-manipulation gap-1 rounded-[0.95rem] border bg-[#fffaf0] px-3 py-2 text-left shadow-[0_10px_22px_rgba(32,24,12,0.14),inset_0_1px_0_rgba(255,255,255,0.95)]",
          selected ? "border-black ring-[3px] ring-black/10" : "border-black/42",
        ].join(" ")}
        type="button"
      >
        <span className="flex items-center gap-2">
          {player.number ? <span className="text-[0.64rem] font-black text-black/48">#{player.number}</span> : null}
          <input
            aria-label={`${player.name} name`}
            className="min-w-0 flex-1 bg-transparent text-sm font-black tracking-[-0.03em] text-black outline-none"
            onChange={(event) => onUpdate({ name: event.target.value })}
            onFocus={onSelect}
            value={player.name}
          />
        </span>
        <input
          aria-label={`${player.name} role`}
          className="w-full bg-transparent text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-black/42 outline-none"
          onChange={(event) => onUpdate({ role: event.target.value })}
          onFocus={onSelect}
          value={player.role}
        />
      </button>
    </motion.div>
  )
}

function DrawingSurface({
  draftStroke,
  events,
  pendingSpot,
  players,
  strokes,
  tool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  draftStroke: ActionStroke | null
  events: SpotEvent[]
  pendingSpot: CourtPoint | null
  players: PlayerToken[]
  strokes: ActionStroke[]
  tool: Tool
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
}) {
  const visibleStrokes = draftStroke ? [...strokes, draftStroke] : strokes

  return (
    <svg
      aria-label="Coaching drawing surface"
      className="absolute inset-0 z-20 h-full w-full touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      viewBox="0 0 100 100"
    >
      {visibleStrokes.map((stroke) => (
        <polyline fill="none" key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")} stroke="rgba(8,8,7,0.8)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.72" />
      ))}
      {events.map((event) => {
        const player = players.find((item) => item.id === event.playerId)

        return (
          <g key={event.id}>
            <circle cx={event.x} cy={event.y} fill={resultColor(event.result)} opacity="0.9" r="1.65" stroke="rgba(8,8,7,0.86)" strokeWidth="0.35" />
            <text fill="rgba(8,8,7,0.62)" fontSize="2" fontWeight="800" textAnchor="middle" x={event.x} y={event.y + 4.4}>
              {player?.number ? `#${player.number}` : player?.name.slice(0, 2)}
            </text>
          </g>
        )
      })}
      {pendingSpot ? <circle cx={pendingSpot.x} cy={pendingSpot.y} fill="none" r="3.1" stroke="rgba(8,8,7,0.8)" strokeDasharray="1.2 1" strokeWidth="0.5" /> : null}
      <rect fill="transparent" height="100" width="100" />
      <title>{tool === "draw" ? "Draw action" : tool === "erase" ? "Erase action" : tool === "spot" ? "Place result spot" : "Move player tokens"}</title>
    </svg>
  )
}

function ResultPicker({
  onCancel,
  onResult,
  pendingSpot,
  player,
}: {
  onCancel: () => void
  onResult: (result: ResultType) => void
  pendingSpot: CourtPoint | null
  player: PlayerToken
}) {
  if (!pendingSpot) return null

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="absolute z-40 grid w-[min(19rem,62vw)] gap-2 rounded-[1rem] border border-black/18 bg-[#fffaf0]/94 p-3 shadow-[0_16px_40px_rgba(42,32,14,0.16)] backdrop-blur-xl"
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      style={{ left: `${clamp(pendingSpot.x, 16, 84)}%`, top: `${clamp(pendingSpot.y, 16, 78)}%`, transform: "translate(-50%, -50%)" }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-black/52">{player.name}</span>
        <button className="text-xs font-semibold text-black/40" onClick={onCancel} type="button">
          close
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {resultTypes.map((result) => (
          <button className="rounded-full border border-black/16 bg-white px-2 py-2 text-[0.64rem] font-black uppercase tracking-[0.08em] text-black/72" key={result} onClick={() => onResult(result)} type="button">
            {result}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

function BoardDock({
  events,
  packageEventIds,
  packageEvents,
  packageMode,
  selectedPlayer,
  setPackageMode,
  setTool,
  togglePackageEvent,
  tool,
  wipe,
}: {
  events: SpotEvent[]
  packageEventIds: string[]
  packageEvents: SpotEvent[]
  packageMode: PackageMode
  selectedPlayer: PlayerToken
  setPackageMode: (mode: PackageMode) => void
  setTool: (tool: Tool) => void
  togglePackageEvent: (id: string) => void
  tool: Tool
  wipe: () => void
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-3 rounded-[1.2rem] border border-black/16 bg-[#fffdf7]/90 p-3 shadow-[0_12px_34px_rgba(72,56,31,0.08),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-xl md:grid-cols-[auto_1fr] md:items-center">
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ToolButton active={tool === "move"} label="Move" onClick={() => setTool("move")} />
        <ToolButton active={tool === "draw"} label="Draw" onClick={() => setTool("draw")} />
        <ToolButton active={tool === "erase"} label="Erase" onClick={() => setTool("erase")} />
        <ToolButton active={tool === "spot"} label="Spot" onClick={() => setTool("spot")} />
        <button className="rounded-full border border-black/14 px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-black/42" onClick={wipe} type="button">
          Wipe
        </button>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-black/42">{selectedPlayer.name} package</span>
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {packageModes.map((mode) => (
              <button className={mode === packageMode ? packageModeButtonClass(true) : packageModeButtonClass(false)} key={mode} onClick={() => setPackageMode(mode)} type="button">
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-h-11 overflow-hidden rounded-[0.85rem] border border-black/10 bg-black/[0.035] px-2 py-2">
          <div className="absolute inset-y-0 left-0 bg-black/[0.055]" style={{ width: `${Math.min(100, Math.max(8, packageEvents.length * 20))}%` }} />
          <div className="relative flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {events.length === 0 ? <span className="px-2 text-xs font-semibold text-black/42">Use Spot to capture makes, misses, turnovers, assists, and late help.</span> : null}
            {events.map((event) => (
              <button
                className={[
                  "shrink-0 rounded-full border px-3 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.08em]",
                  packageEventIds.includes(event.id) ? "border-black bg-black text-[#fff8e9]" : "border-black/16 bg-[#fffaf0] text-black/56",
                ].join(" ")}
                key={event.id}
                onClick={() => togglePackageEvent(event.id)}
                type="button"
              >
                {event.result}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={active ? activeToolClass() : inactiveToolClass()} onClick={onClick} type="button">
      {label}
    </button>
  )
}

function CourtGeometry({ pressure }: { pressure: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 580">
        <g fill="none" stroke="rgba(8,8,7,0.94)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6.5">
          <rect height="532" rx="2" width="952" x="24" y="24" />
          <path d="M500 24v532" />
          <circle cx="500" cy="290" r="72" />
          <rect height="200" width="190" x="24" y="190" />
          <rect height="200" width="190" x="786" y="190" />
          <circle cx="214" cy="290" r="70" />
          <circle cx="786" cy="290" r="70" />
          <path d="M24 86h116" />
          <path d="M24 494h116" />
          <path d="M140 86C316 125 316 455 140 494" />
          <path d="M976 86H860" />
          <path d="M976 494H860" />
          <path d="M860 86C684 125 684 455 860 494" />
          <path d="M80 252v76" />
          <path d="M920 252v76" />
          <circle cx="94" cy="290" r="14" />
          <circle cx="906" cy="290" r="14" />
          <path d="M118 260a34 34 0 0 1 0 60" />
          <path d="M882 260a34 34 0 0 0 0 60" />
        </g>
        <motion.g animate={{ opacity: 0.16 + pressure * 0.16 }} fill="none" stroke="rgba(8,8,7,0.46)" strokeLinecap="round" strokeWidth="3" transition={{ duration: 0.7 }}>
          <path d="M214 190v200" strokeDasharray="12 14" />
          <path d="M786 190v200" strokeDasharray="12 14" />
          <path d="M312 174C420 146 576 148 688 176" />
          <path d="M312 406C428 438 574 436 688 404" />
        </motion.g>
      </svg>
      <motion.div animate={{ opacity: 0.08 + pressure * 0.1 }} className="absolute inset-0 bg-[radial-gradient(circle_at_72%_38%,rgba(214,166,82,0.15),transparent_18%),radial-gradient(circle_at_40%_58%,rgba(8,8,7,0.05),transparent_20%)]" transition={{ duration: 0.7 }} />
    </div>
  )
}

function TacticalTicker({ items }: { items: string[] }) {
  return (
    <div className="hidden max-w-[40vw] items-center gap-2 overflow-hidden rounded-full border border-black/12 bg-white/60 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:flex">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black/70" />
      <span className="truncate text-xs font-semibold text-black/56">{items[0]}</span>
    </div>
  )
}

function SurfaceMemory({ pressure }: { pressure: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ opacity: 0.1 + pressure * 0.08, scale: [1, 1.01, 1] }}
        className="absolute left-1/2 top-1/2 h-[84vmin] w-[84vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(213,166,88,0.22),transparent_68%)] blur-2xl"
        transition={{ duration: 13, ease: "easeInOut", repeat: Infinity }}
      />
    </div>
  )
}

function buildTicker(events: SpotEvent[], players: PlayerToken[]) {
  const latest = events.at(-1)
  if (!latest) return baselineTicker

  const player = players.find((item) => item.id === latest.playerId)
  const name = player?.name ?? "Player"
  const resultLanguage: Record<ResultType, string> = {
    assist: `${name} creating connected touches`,
    collapse: `Paint collapse forming around ${name}`,
    "help late": `Weak-side help arriving late`,
    make: `${name} touch converting from this spot`,
    miss: `${name} shot quality stored for review`,
    turnover: `${name} pressure moment added to package`,
  }

  return [resultLanguage[latest.result], ...baselineTicker]
}

function resultColor(result: ResultType) {
  if (result === "make" || result === "assist") return "rgba(29,112,64,0.88)"
  if (result === "miss" || result === "turnover" || result === "collapse") return "rgba(8,8,7,0.82)"
  return "rgba(202,139,31,0.9)"
}

function distance(a: CourtPoint, b: CourtPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function packageModeButtonClass(active: boolean) {
  return [
    "shrink-0 rounded-full border px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.1em] transition-colors",
    active ? "border-black bg-black text-[#fff8e9]" : "border-black/14 bg-transparent text-black/46",
  ].join(" ")
}

function activeToolClass() {
  return "rounded-full border border-black bg-black px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#fff8e9]"
}

function inactiveToolClass() {
  return "rounded-full border border-black/14 bg-transparent px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-black/48"
}
