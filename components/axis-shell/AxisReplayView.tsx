"use client"

import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisReplayView() {
  const replay = useAxisStore((state) => state.replayState)
  const selected = useAxisStore((state) => state.selectedReplay)

  return (
    <div className={styles.replay} aria-label="Axis replay state">
      <div className={styles.replaySurface}>
        <span>{replay.timestamp}</span>
      </div>
      <div className={styles.replayCopy}>
        <span>{replay.status}</span>
        <p>{selected?.label ?? replay.title}</p>
        <small>{selected?.continuity ?? "Replay opens inside the same memory environment."}</small>
      </div>
    </div>
  )
}
