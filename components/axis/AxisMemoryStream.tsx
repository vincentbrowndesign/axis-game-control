"use client"

import { useMemo } from "react"
import { useAxisStore } from "@/store/useAxisStore"

export function AxisMemoryStream() {
  const moments = useAxisStore((state) => state.moments)
  const filter = useAxisStore((state) => state.memoryFilter)

  const visibleMoments = useMemo(() => {
    if (filter === "all" || filter === "semantic") return moments
    return moments.filter((moment) => moment.tags.some((tag) => filter.includes(tag) || tag.includes(filter)))
  }, [filter, moments])

  return (
    <section className="axis-v2-memory-stream" aria-label="Axis memory stream">
      {visibleMoments.length ? (
        visibleMoments.map((moment) => (
          <article key={moment.id} className="axis-v2-memory-moment">
            <p>{moment.label}</p>
            <div>
              <span>{moment.time}</span>
              <span>{moment.score}</span>
              <span>{moment.context}</span>
            </div>
          </article>
        ))
      ) : (
        <article className="axis-v2-memory-moment">
          <p>No matching memory yet</p>
          <div>
            <span>ready</span>
            <span>live context</span>
          </div>
        </article>
      )}
    </section>
  )
}
