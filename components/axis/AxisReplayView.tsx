"use client"

import { useAxisStore } from "@/store/useAxisStore"

export function AxisReplayView() {
  const replayFocus = useAxisStore((state) => state.replayFocus)
  const moments = useAxisStore((state) => state.moments)
  const focusMoment = moments[0]

  return (
    <section className="axis-v2-replay-view" aria-label="Axis replay">
      <div className="axis-v2-replay-surface">
        <span>{focusMoment?.time || "00:00"}</span>
      </div>
      <div className="axis-v2-replay-caption">
        <p>{replayFocus || focusMoment?.label || "Replay memory"}</p>
        <span>{focusMoment?.score || "memory ready"}</span>
      </div>
    </section>
  )
}
