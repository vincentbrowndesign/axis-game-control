"use client"

import Link from "next/link"
import { useCallback, useMemo, useSyncExternalStore } from "react"
import {
  getActiveContinuity,
  type ActiveContinuityState,
} from "@/lib/world/getActiveContinuity"

type Props = {
  preferredWarmupId?: string | null
  fallback: ActiveContinuityState
}

export default function ContinueMemory({
  preferredWarmupId = null,
  fallback,
}: Props) {
  const fallbackSnapshot = useMemo(
    () => JSON.stringify(fallback),
    [fallback]
  )
  const getSnapshot = useCallback(
    () => JSON.stringify(getActiveContinuity({ preferredWarmupId })),
    [preferredWarmupId]
  )
  const snapshot = useSyncExternalStore(
    subscribeToContinuity,
    getSnapshot,
    () => fallbackSnapshot
  )
  const state = JSON.parse(snapshot) as ActiveContinuityState


  return (
    <div className="mt-10 max-w-xl border-t border-white/10 pt-6">
      <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
        Active Continuity
      </p>
      <p className="mt-4 text-2xl font-black uppercase leading-tight tracking-[-0.035em] text-white">
        {state.title}
      </p>
      <p className="mt-3 text-base leading-relaxed text-white/45">
        {state.line}
      </p>
      <Link
        href={state.href}
        className="mt-6 inline-flex bg-white px-8 py-5 text-sm font-black uppercase tracking-[0.24em] text-black transition hover:bg-lime-300"
      >
        {state.actionLabel}
      </Link>
    </div>
  )
}

function subscribeToContinuity(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}

  window.addEventListener("storage", onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
  }
}
