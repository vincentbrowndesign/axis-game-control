"use client"

import { AxisRail } from "@/components/axis-shell/AxisRail"
import { AxisViewport } from "@/components/axis-shell/AxisViewport"
import { useAxisStore, type AxisMemoryNode } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisShell() {
  const memories = useAxisStore((state) => state.memoryState.nodes)

  return (
    <main className={styles.shell} data-mode="live">
      <AxisViewport />

      <MemoryResidue memories={memories} />

      <footer className={styles.railDock}>
        <AxisRail />
      </footer>
    </main>
  )
}

function MemoryResidue({ memories }: { memories: AxisMemoryNode[] }) {
  const residue = memories.slice(0, 4)

  if (!residue.length) return null

  return (
    <section className={styles.memoryResidue} aria-label="Settled memory residue">
      {residue.map((memory) => (
        <article key={memory.id}>
          <span>{memory.time}</span>
          <p>{memory.label}</p>
        </article>
      ))}
    </section>
  )
}
