"use client"

import { AxisRail } from "@/components/axis-shell/AxisRail"
import { AxisViewport } from "@/components/axis-shell/AxisViewport"
import styles from "./AxisShell.module.css"

export function AxisShell() {
  return (
    <main className={styles.shell} data-mode="live">
      <AxisViewport />

      <footer className={styles.railDock}>
        <AxisRail />
      </footer>
    </main>
  )
}
