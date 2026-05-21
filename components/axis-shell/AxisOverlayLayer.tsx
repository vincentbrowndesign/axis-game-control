"use client"

import { useEffect } from "react"
import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

const bonePairs = [
  ["head", "leftShoulder"],
  ["head", "rightShoulder"],
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "hip"],
  ["rightShoulder", "hip"],
  ["hip", "leftKnee"],
  ["hip", "rightKnee"],
  ["leftKnee", "leftFoot"],
  ["rightKnee", "rightFoot"],
] as const

export function AxisOverlayLayer() {
  const overlay = useAxisStore((state) => state.activeOverlay)
  const dismissOverlay = useAxisStore((state) => state.dismissOverlay)

  useEffect(() => {
    if (!overlay) return
    const timeout = window.setTimeout(dismissOverlay, 6800)
    return () => window.clearTimeout(timeout)
  }, [dismissOverlay, overlay])

  if (!overlay) return null

  const landmarks = overlay.output.landmarks
  const movementPath = overlay.output.movementPath

  return (
    <div className={styles.overlayLayer} aria-label={`${overlay.label} overlay`}>
      <svg className={styles.overlaySvg} viewBox="0 0 100 100" role="img" aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <filter id="axis-overlay-softness">
            <feGaussianBlur stdDeviation="0.18" />
          </filter>
        </defs>

        {overlay.focus === "movement" ? (
          <polyline
            className={styles.movementPath}
            points={movementPath.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ) : null}

        {overlay.focus === "balance" || overlay.focus === "skeleton" ? (
          <line className={styles.balanceAxis} x1="51" y1="22" x2="51" y2="92" />
        ) : null}

        {overlay.focus === "shoulders" || overlay.focus === "skeleton" ? (
          <line
            className={styles.alignmentLine}
            x1={landmarks.leftShoulder.x}
            y1={landmarks.leftShoulder.y}
            x2={landmarks.rightShoulder.x}
            y2={landmarks.rightShoulder.y}
          />
        ) : null}

        {overlay.focus === "feet" || overlay.focus === "skeleton" ? (
          <line
            className={styles.footLine}
            x1={landmarks.leftFoot.x}
            y1={landmarks.leftFoot.y}
            x2={landmarks.rightFoot.x}
            y2={landmarks.rightFoot.y}
          />
        ) : null}

        {overlay.focus === "release" ? (
          <line
            className={styles.releaseLine}
            x1={landmarks.rightWrist.x}
            y1={landmarks.rightWrist.y}
            x2="84"
            y2="10"
          />
        ) : null}

        {bonePairs.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            className={styles.skeletonLine}
            x1={landmarks[from].x}
            y1={landmarks[from].y}
            x2={landmarks[to].x}
            y2={landmarks[to].y}
          />
        ))}

        {Object.entries(landmarks).map(([key, point]) => (
          <circle key={key} className={styles.landmarkPoint} cx={point.x} cy={point.y} r="0.62" />
        ))}
      </svg>
      <div className={styles.overlayCaption}>
        <span>{overlay.label}</span>
      </div>
    </div>
  )
}
