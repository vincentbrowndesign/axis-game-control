"use client"

import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisScoreboard() {
  const mode = useAxisStore((state) => state.mode)
  const session = useAxisStore((state) => state.sessionState)

  if (mode === "live") {
    return (
      <div className={styles.scoreboard} aria-label="Current game state">
        <span>
          {session.score.home}-{session.score.away}
        </span>
        <span>{session.quarter}</span>
      </div>
    )
  }

  return (
    <div className={styles.scoreboard} aria-label="Current game state">
      <span>Home {session.score.home}</span>
      <span>{session.quarter}</span>
      <span>Away {session.score.away}</span>
      <span>{session.possession}</span>
    </div>
  )
}
