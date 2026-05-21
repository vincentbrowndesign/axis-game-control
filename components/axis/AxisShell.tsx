"use client"

import { useEffect } from "react"
import { AxisRail } from "@/components/axis/AxisRail"
import { AxisScoreboard } from "@/components/axis/AxisScoreboard"
import { AxisViewport } from "@/components/axis/AxisViewport"
import { useAxisStore } from "@/store/useAxisStore"
import type { AxisViewState } from "@/lib/axis/intent"

export function AxisShell({ initialView = "memory" }: { initialView?: AxisViewState }) {
  const view = useAxisStore((state) => state.view)
  const setView = useAxisStore((state) => state.setView)

  useEffect(() => {
    setView(initialView)
  }, [initialView, setView])

  return (
    <section className="axis-v2-shell">
      <header className="axis-v2-topbar">
        <div>
          <span>AXIS</span>
          <span>{view}</span>
        </div>
        <AxisScoreboard />
      </header>
      <AxisViewport />
      <AxisRail />
    </section>
  )
}
