"use client"

import { useMemo } from "react"
import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisMemoryStream() {
  const memory = useAxisStore((state) => state.memoryState)

  const nodes = useMemo(() => {
    if (memory.filter === "all" || memory.filter === "semantic") return memory.nodes
    return memory.nodes.filter((node) =>
      node.tags.some((tag) => tag.includes(memory.filter) || memory.filter.includes(tag)),
    )
  }, [memory.filter, memory.nodes])

  return (
    <div className={styles.memoryStream} aria-label="Axis memory stream">
      <div className={styles.memoryHeading}>
        <span>{memory.query}</span>
      </div>
      {nodes.map((node) => (
        <article key={node.id} className={styles.memoryNode}>
          <div>
            <span>{node.time}</span>
            <span>{node.score}</span>
            {node.replayLinked ? <span>replay</span> : null}
          </div>
          <p>{node.label}</p>
          <small>{node.continuity}</small>
        </article>
      ))}
    </div>
  )
}
