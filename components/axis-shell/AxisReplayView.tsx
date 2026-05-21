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
        <span>Replay</span>
        <p>{selected?.label ?? replay.title}</p>
      </div>
    </div>
  )
}
