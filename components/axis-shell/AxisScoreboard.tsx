"use client"

import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisScoreboard() {
  const session = useAxisStore((state) => state.sessionState)

  return (
    <div className={styles.scoreboard} aria-label="Current game state">
      <span>Home {session.score.home}</span>
      <span>{session.quarter}</span>
      <span>Away {session.score.away}</span>
      <span>{session.possession}</span>
    </div>
  )
}
