"use client"

import { useAxisStore } from "@/store/useAxisStore"
import { AxisMemoryStream } from "@/components/axis/AxisMemoryStream"
import { AxisReplayView } from "@/components/axis/AxisReplayView"

export function AxisViewport() {
  const view = useAxisStore((state) => state.view)
  const lastIntent = useAxisStore((state) => state.lastIntent)

  return (
    <main className="axis-v2-viewport" aria-label="Axis viewport">
      {view === "live" ? (
        <section className="axis-v2-live-world">
          <div className="axis-v2-live-lens" />
          <p>Live memory observation</p>
        </section>
      ) : null}

      {view === "memory" ? <AxisMemoryStream /> : null}

      {view === "replay" ? <AxisReplayView /> : null}

      {view === "inspect" ? (
        <section className="axis-v2-inspect-view">
          <p>{lastIntent?.label || "Inspect"}</p>
          <span>Context will surface here when the moment asks for it.</span>
        </section>
      ) : null}
    </main>
  )
}
