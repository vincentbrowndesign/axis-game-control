"use client"

import { AxisMemoryStream } from "@/components/axis-shell/AxisMemoryStream"
import { AxisReplayView } from "@/components/axis-shell/AxisReplayView"
import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisViewport() {
  const mode = useAxisStore((state) => state.mode)
  const activeOverlay = useAxisStore((state) => state.activeOverlay)

  return (
    <section className={styles.viewport} aria-label="Axis center viewport">
      {mode === "live" ? <LiveMemoryWorld /> : null}
      {mode === "memory" ? <AxisMemoryStream /> : null}
      {mode === "replay" ? <AxisReplayView /> : null}
      {mode === "inspect" ? <InspectView label={activeOverlay?.label ?? "movement context"} /> : null}
    </section>
  )
}

function LiveMemoryWorld() {
  return (
    <div className={styles.liveWorld}>
      <div className={styles.nativeLens} aria-hidden="true">
        <span />
      </div>
      <p>Live memory observation</p>
    </div>
  )
}

function InspectView({ label }: { label: string }) {
  return (
    <div className={styles.inspect}>
      <span>Inspect</span>
      <p>{label}</p>
    </div>
  )
}
