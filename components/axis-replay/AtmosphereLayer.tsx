"use client"

import type { RefObject } from "react"
import styles from "./BehavioralTelemetryPlayer.module.css"

type AtmosphereLayerProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
}

export function AtmosphereLayer({ canvasRef }: AtmosphereLayerProps) {
  return <canvas aria-hidden="true" className={styles.atmosphereLayer} ref={canvasRef} />
}
