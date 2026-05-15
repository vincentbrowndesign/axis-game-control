"use client"

import { Player } from "@remotion/player"
import { motion } from "motion/react"
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion"
import type { ReplayReveal } from "@/lib/replay/revealEngine"
import type { MemoryCinemaState } from "@/lib/replay/memoryCinema"

function CinemaComposition({
  reveals,
  state,
}: {
  reveals: ReplayReveal[]
  state: MemoryCinemaState
}) {
  const frame = useCurrentFrame()
  const pulse = interpolate(frame % 120, [0, 60, 120], [0.2, 0.5, 0.2])
  const activeReveal =
    reveals.find((reveal) => reveal.phase !== "withholding") ||
    reveals[0]

  return (
    <AbsoluteFill
      style={{
        background:
          state.tone === "rhythm"
            ? `radial-gradient(circle at 50% 50%, rgba(190,242,100,${pulse * 0.16}), transparent 58%)`
            : `radial-gradient(circle at 50% 50%, rgba(103,232,249,${pulse * 0.12}), transparent 62%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "14%",
          border: "1px solid rgba(255,255,255,0.08)",
          opacity: 0.28 + state.depth * 0.22,
          transform: `scale(${1 + pulse * 0.012})`,
        }}
      />
      {activeReveal ? (
        <div
          style={{
            position: "absolute",
            left: "7%",
            right: "7%",
            bottom: "8%",
            height: 2,
            background:
              "linear-gradient(90deg, transparent, rgba(190,242,100,0.7), rgba(103,232,249,0.5), transparent)",
            opacity: 0.3 + activeReveal.emphasis * 0.42,
          }}
        />
      ) : null}
    </AbsoluteFill>
  )
}

export function MemoryCinemaLayer({
  reveals,
  state,
}: {
  reveals: ReplayReveal[]
  state: MemoryCinemaState
}) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      <Player
        component={CinemaComposition}
        inputProps={{ reveals, state }}
        durationInFrames={180}
        compositionWidth={1280}
        compositionHeight={720}
        fps={30}
        autoPlay
        loop
        controls={false}
        style={{
          width: "100%",
          height: "100%",
          opacity: 0.72,
        }}
      />
    </motion.div>
  )
}
