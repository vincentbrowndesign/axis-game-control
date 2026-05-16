"use client"

import Link from "next/link"
import { useCallback, useMemo, useSyncExternalStore } from "react"
import {
  getActiveContinuity,
  type ActiveContinuityState,
} from "@/lib/world/getActiveContinuity"

type Props = {
  preferredWarmupId?: string | null
  fallbackName?: string | null
  fallback: ActiveContinuityState
}

export default function ContinueMemory({
  preferredWarmupId = null,
  fallbackName = null,
  fallback,
}: Props) {
  const fallbackSnapshot = useMemo(
    () => JSON.stringify(fallback),
    [fallback]
  )
  const getSnapshot = useCallback(
    () =>
      JSON.stringify(
        getActiveContinuity({ preferredWarmupId, fallbackName })
      ),
    [fallbackName, preferredWarmupId]
  )
  const snapshot = useSyncExternalStore(
    subscribeToContinuity,
    getSnapshot,
    () => fallbackSnapshot
  )
  const state = JSON.parse(snapshot) as ActiveContinuityState


  return (
    <div className="mt-10 max-w-2xl border-t border-lime-300/40 pt-7">
      <p className="text-[10px] uppercase tracking-[0.45em] text-lime-300">
        {state.eyebrow}
      </p>
      <p className="mt-4 text-[clamp(2.4rem,7vw,5.6rem)] font-black uppercase leading-[0.86] tracking-[-0.06em] text-white">
        {state.title}
      </p>
      <p className="mt-5 text-xl leading-relaxed text-white/55">
        {state.line}
      </p>
      <Link
        href={state.href}
        className="mt-8 inline-flex bg-white px-9 py-5 text-sm font-black uppercase tracking-[0.24em] text-black transition hover:bg-lime-300"
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
