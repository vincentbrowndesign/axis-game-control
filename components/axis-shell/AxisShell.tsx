"use client"

import { Mic, Pencil, ScanLine, Sparkle, X } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { AxisViewport, type AxisRoomDot, type AxisRoomStroke, type AxisRoomTool } from "@/components/axis-shell/AxisViewport"
import styles from "./AxisShell.module.css"

type RoomTool = AxisRoomTool

const roomPresence = ["V", "AJ", "BK"]
const densityMarks = [0.08, 0.16, 0.25, 0.33, 0.47, 0.58, 0.63, 0.74, 0.86]

export function AxisShell() {
  const [activeTool, setActiveTool] = useState<RoomTool>("draw")
  const [strokes, setStrokes] = useState<AxisRoomStroke[]>([])
  const [dots, setDots] = useState<AxisRoomDot[]>([])
  const [scrubProgress, setScrubProgress] = useState(0.38)
  const roomDensity = useMemo(() => {
    const activeStrokeWeight = strokes.filter((stroke) => !stroke.ghosted).reduce((total, stroke) => total + stroke.intensity, 0)
    const ghostWeight = strokes.filter((stroke) => stroke.ghosted).length * 0.045 + dots.filter((dot) => dot.ghosted).length * 0.03
    const activeDotWeight = dots.filter((dot) => !dot.ghosted).reduce((total, dot) => total + dot.pressure * 0.08, 0)

    return Math.min(1, activeStrokeWeight * 0.16 + activeDotWeight + ghostWeight + scrubProgress * 0.22 || 0.18)
  }, [dots, scrubProgress, strokes])

  function wipeRoom() {
    const revisedAt = Date.now()
    setStrokes((current) => current.map((stroke) => ({ ...stroke, ghosted: true, revisedAt })).slice(-18))
    setDots((current) => current.map((dot) => ({ ...dot, ghosted: true, revisedAt })).slice(-28))
  }

  return (
    <main className={styles.shell} data-mode="room">
      <header className={styles.roomTop} aria-label="Room presence">
        <div className={styles.presenceCluster}>
          {roomPresence.map((person) => (
            <span key={person}>{person}</span>
          ))}
        </div>
        <div className={styles.roomDensity} aria-label="Replay density">
          {densityMarks.map((mark) => (
            <i key={mark} style={{ opacity: 0.18 + mark * roomDensity }} />
          ))}
        </div>
      </header>

      <AxisViewport activeTool={activeTool} dots={dots} setDots={setDots} setStrokes={setStrokes} strokes={strokes} />

      <footer className={styles.roomDock} aria-label="Room controls">
        <ReplayRail progress={scrubProgress} setProgress={setScrubProgress} />
        <VoiceTrace active={activeTool === "voice"} />
        <ControlDock activeTool={activeTool} setActiveTool={setActiveTool} wipeRoom={wipeRoom} />
      </footer>
    </main>
  )
}

function ReplayRail({ progress, setProgress }: { progress: number; setProgress: (progress: number) => void }) {
  return (
    <div className={styles.replayRail} aria-label="Replay rail">
      <span />
      <input
        aria-label="Scrub replay"
        max="1"
        min="0"
        onChange={(event) => setProgress(Number(event.target.value))}
        step="0.01"
        type="range"
        value={progress}
      />
      <span />
    </div>
  )
}

function VoiceTrace({ active }: { active: boolean }) {
  return (
    <div className={styles.voiceTrace} data-active={active ? "true" : "false"} aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <i key={index} style={{ animationDelay: `${index * 52}ms` }} />
      ))}
    </div>
  )
}

function ControlDock({
  activeTool,
  setActiveTool,
  wipeRoom,
}: {
  activeTool: RoomTool
  setActiveTool: (tool: RoomTool) => void
  wipeRoom: () => void
}) {
  return (
    <nav className={styles.controlDock} aria-label="Room tools">
      <ToolButton active={activeTool === "draw"} icon={<Pencil aria-hidden="true" />} label="Draw" onClick={() => setActiveTool("draw")} />
      <ToolButton active={activeTool === "dot"} icon={<Sparkle aria-hidden="true" />} label="Dot" onClick={() => setActiveTool("dot")} />
      <ToolButton active={activeTool === "voice"} icon={<Mic aria-hidden="true" />} label="Voice" onClick={() => setActiveTool("voice")} />
      <ToolButton active={activeTool === "scrub"} icon={<ScanLine aria-hidden="true" />} label="Scrub" onClick={() => setActiveTool("scrub")} />
      <ToolButton icon={<X aria-hidden="true" />} label="Wipe" onClick={wipeRoom} />
    </nav>
  )
}

function ToolButton({ active = false, icon, label, onClick }: { active?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={styles.toolButton} data-active={active ? "true" : "false"} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}
