"use client"

import { AxisRail } from "@/components/axis-shell/AxisRail"
import { AxisScoreboard } from "@/components/axis-shell/AxisScoreboard"
import { AxisViewport } from "@/components/axis-shell/AxisViewport"
import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisShell() {
  const mode = useAxisStore((state) => state.mode)
  const continuity = useAxisStore((state) => state.sessionState.continuity)

  return (
    <main className={styles.shell} data-mode={mode}>
      <header className={styles.telemetry} aria-label="Axis session telemetry">
        <div className={styles.session}>
          <span>Axis</span>
          <strong>{mode}</strong>
        </div>
        <div className={styles.continuity}>
          <span>{continuity}</span>
        </div>
        <AxisScoreboard />
      </header>

      <AxisViewport />

      <footer className={styles.railDock}>
        <AxisRail />
      </footer>
    </main>
  )
}
