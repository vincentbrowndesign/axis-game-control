"use client"

import type { RefObject } from "react"
import styles from "./BehavioralTelemetryPlayer.module.css"

type TopologyRailProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
}

export function TopologyRail({ canvasRef }: TopologyRailProps) {
  return <canvas aria-label="Axis behavioral memory terrain" className={styles.topologyRail} ref={canvasRef} />
}
