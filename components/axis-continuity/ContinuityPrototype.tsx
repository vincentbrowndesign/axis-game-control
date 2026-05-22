"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"

type ContinuityState = "active" | "dormant" | "resurfacing" | "unresolved" | "collapsing" | "resolved"
type MachinePosture = "convergent" | "expansive" | "tense" | "hollow"

type ContinuityObject = {
  id: string
  title: string
  caption: string
  state: ContinuityState
  weight: number
  pressure: number
  health: number
  recency: number
  proximity: number
  pulse: number
  memory: string
}

const objects: ContinuityObject[] = [
  {
    id: "weak-side-return",
    title: "Weak-side return",
    caption: "Same help pattern keeps resurfacing after the second reversal.",
    state: "active",
    weight: 0.92,
    pressure: 0.62,
    health: 0.78,
    recency: 0.86,
    proximity: 0.98,
    pulse: 7.4,
    memory: "8 touches / 3 rewinds",
  },
  {
    id: "late-clock-drift",
    title: "Late-clock drift",
    caption: "Spacing softens when the possession gets narrow.",
    state: "unresolved",
    weight: 0.71,
    pressure: 0.84,
    health: 0.48,
    recency: 0.72,
    proximity: 0.82,
    pulse: 8.8,
    memory: "unresolved",
  },
  {
    id: "corner-pressure",
    title: "Corner pressure",
    caption: "Attention keeps returning to the right corner entry.",
    state: "resurfacing",
    weight: 0.66,
    pressure: 0.58,
    health: 0.7,
    recency: 0.94,
    proximity: 0.68,
    pulse: 6.6,
    memory: "waking",
  },
  {
    id: "empty-side-trigger",
    title: "Empty-side trigger",
    caption: "Quiet object with one high-value replay attached.",
    state: "dormant",
    weight: 0.38,
    pressure: 0.26,
    health: 0.64,
    recency: 0.31,
    proximity: 0.54,
    pulse: 11.2,
    memory: "low signal",
  },
  {
    id: "timeout-reset",
    title: "Timeout reset",
    caption: "Shape stabilizes after the coach correction.",
    state: "resolved",
    weight: 0.58,
    pressure: 0.18,
    health: 0.92,
    recency: 0.48,
    proximity: 0.47,
    pulse: 10.4,
    memory: "resolved",
  },
  {
    id: "transition-leak",
    title: "Transition leak",
    caption: "Object is losing integrity as better evidence appears.",
    state: "collapsing",
    weight: 0.43,
    pressure: 0.52,
    health: 0.27,
    recency: 0.4,
    proximity: 0.33,
    pulse: 9.6,
    memory: "fading",
  },
  {
    id: "second-side-spurt",
    title: "Second-side spurt",
    caption: "Connected to the weak-side return object by replay behavior.",
    state: "resurfacing",
    weight: 0.79,
    pressure: 0.66,
    health: 0.72,
    recency: 0.77,
    proximity: 0.9,
    pulse: 7.9,
    memory: "paired pulse",
  },
  {
    id: "dead-ball-window",
    title: "Dead-ball window",
    caption: "Lower signal density, but high relational proximity.",
    state: "dormant",
    weight: 0.31,
    pressure: 0.34,
    health: 0.59,
    recency: 0.28,
    proximity: 0.76,
    pulse: 12.8,
    memory: "waiting",
  },
]

const postureCopy: Record<MachinePosture, string> = {
  convergent: "attention tightening",
  expansive: "search field opening",
  tense: "unresolved pressure rising",
  hollow: "low signal density",
}

const postureByState: Record<ContinuityState, MachinePosture> = {
  active: "convergent",
  dormant: "hollow",
  resurfacing: "expansive",
  unresolved: "tense",
  collapsing: "tense",
  resolved: "convergent",
}

export function ContinuityPrototype() {
  const [activeId, setActiveId] = useState(objects[0].id)
  const activeObject = objects.find((object) => object.id === activeId) ?? objects[0]
  const posture = postureByState[activeObject.state]
  const railObjects = useMemo(() => orderObjects(objects, activeObject), [activeObject])

  return (
    <main className={surfaceClass(posture)}>
      <Atmosphere posture={posture} />

      <header className="relative z-10 flex min-h-16 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] text-[0.62rem] uppercase tracking-[0.18em] text-stone-200/46 md:px-8">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f4e7bb]/70 shadow-[0_0_18px_rgba(244,231,187,0.42)]" />
          <span>{posture}</span>
        </div>
        <span className="hidden text-stone-200/32 sm:block">{postureCopy[posture]}</span>
      </header>

      <section className="relative z-10 grid min-h-0 flex-1 place-items-center px-5 py-4">
        <AnimatePresence mode="wait">
          <ActiveContinuityObject key={activeObject.id} object={activeObject} posture={posture} />
        </AnimatePresence>
      </section>

      <section className="relative z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-7">
        <div className="mx-auto max-w-6xl">
          <div className={railClass(posture)}>
            {railObjects.map((object, index) => (
              <RailObject
                active={object.id === activeObject.id}
                index={index}
                key={object.id}
                object={object}
                posture={posture}
                related={object.proximity > 0.75}
                onSelect={() => setActiveId(object.id)}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function ActiveContinuityObject({ object, posture }: { object: ContinuityObject; posture: MachinePosture }) {
  const pressureScale = 0.94 + object.pressure * 0.08
  const healthOpacity = 0.42 + object.health * 0.44
  const stateTint = getStateTint(object.state)

  return (
    <motion.article
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative grid aspect-square w-[min(72vw,30rem)] place-items-center"
      exit={{ opacity: 0, scale: 0.985, y: 8 }}
      initial={{ opacity: 0, scale: 0.985, y: 8 }}
      transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={{
          opacity: [healthOpacity * 0.54, healthOpacity, healthOpacity * 0.54],
          scale: [pressureScale, pressureScale + 0.035, pressureScale],
        }}
        className="absolute inset-[6%] rounded-[42%] border border-stone-100/10"
        style={{
          background: `radial-gradient(circle at 48% 48%, ${stateTint.core}, transparent 46%), radial-gradient(circle at 50% 50%, rgba(255,255,238,0.08), rgba(255,255,238,0.018) 58%, transparent 72%)`,
          boxShadow: `0 0 ${42 + object.weight * 80}px ${stateTint.glow}`,
        }}
        transition={{ duration: object.pulse, ease: "easeInOut", repeat: Infinity }}
      />

      <motion.div
        animate={{ rotate: posture === "tense" ? [0, 0.35, -0.22, 0] : [0, 0.18, 0] }}
        className={activeShellClass(object.state)}
        transition={{ duration: object.pulse * 1.18, ease: "easeInOut", repeat: Infinity }}
      >
        <div className="absolute inset-[10%] rounded-[38%] border border-stone-100/10 opacity-70" />
        <div className="absolute inset-[20%] rounded-[45%] border border-[#f5e4a6]/10 opacity-80" />
        <div className="absolute inset-[32%] rounded-full bg-[#fff8d8]/[0.08] blur-md" />
        <motion.div
          animate={{ opacity: [0.24, 0.62, 0.24], scale: [0.88, 1.08, 0.88] }}
          className="absolute inset-[24%] rounded-full border border-[#fff5c8]/20"
          transition={{ duration: object.pulse * 0.74, ease: "easeInOut", repeat: Infinity }}
        />
      </motion.div>

      <div className="relative z-10 grid max-w-[19rem] gap-4 text-center">
        <div className="mx-auto flex items-center gap-2 text-[0.58rem] uppercase tracking-[0.2em] text-stone-100/42">
          <span>{object.state}</span>
          <span className="h-px w-6 bg-stone-100/12" />
          <span>{object.memory}</span>
        </div>
        <h1 className="text-balance text-3xl font-medium leading-[0.95] tracking-[-0.03em] text-[#fff9df]/92 sm:text-5xl">{object.title}</h1>
        <p className="mx-auto max-w-[17rem] text-sm leading-5 text-stone-200/50 sm:text-base">{object.caption}</p>
      </div>
    </motion.article>
  )
}

function RailObject({
  active,
  index,
  object,
  posture,
  related,
  onSelect,
}: {
  active: boolean
  index: number
  object: ContinuityObject
  posture: MachinePosture
  related: boolean
  onSelect: () => void
}) {
  const size = 3.35 + object.weight * 2.4
  const opacity = active ? 1 : 0.28 + object.weight * 0.42
  const stateTint = getStateTint(object.state)

  return (
    <motion.button
      animate={{
        opacity,
        y: active ? -10 : related ? -4 : 0,
      }}
      className="group relative flex shrink-0 touch-manipulation flex-col items-center gap-3 border-0 bg-transparent p-0 text-left outline-none"
      initial={false}
      onClick={onSelect}
      style={{ width: `${size + 1.6}rem` }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      type="button"
    >
      <motion.span
        animate={{
          scale: active ? [1, 1.045, 1] : related ? [1, 1.025, 1] : 1,
          opacity: object.state === "collapsing" ? [0.5, 0.38, 0.5] : undefined,
        }}
        className={railObjectClass(object.state, active)}
        style={{
          height: `${size}rem`,
          width: `${size}rem`,
          background: `radial-gradient(circle at 50% 50%, ${stateTint.core}, rgba(255,255,238,0.035) 54%, rgba(255,255,238,0.006) 73%)`,
          boxShadow: active ? `0 0 ${24 + object.weight * 32}px ${stateTint.glow}` : `0 0 ${10 + object.weight * 18}px rgba(245,228,166,0.05)`,
        }}
        transition={{ duration: object.pulse + index * 0.34, ease: "easeInOut", repeat: Infinity }}
      >
        <span className="absolute inset-[22%] rounded-full border border-stone-100/10" />
        <span
          className="absolute bottom-[16%] left-[18%] h-px rounded-full bg-[#fff6ca]/35"
          style={{ width: `${18 + object.health * 48}%` }}
        />
      </motion.span>
      <span className="max-w-[5.8rem] truncate text-[0.58rem] uppercase tracking-[0.12em] text-stone-100/36 group-focus-visible:text-stone-100/82">
        {object.title}
      </span>
      {posture === "tense" && object.state === "unresolved" ? <span className="absolute -top-1 h-1 w-1 rounded-full bg-[#f5e4a6]/70" /> : null}
    </motion.button>
  )
}

function Atmosphere({ posture }: { posture: MachinePosture }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{
          opacity: posture === "hollow" ? 0.16 : posture === "tense" ? 0.32 : 0.24,
          scale: posture === "expansive" ? [1, 1.05, 1] : [1, 1.018, 1],
        }}
        className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,244,198,0.09),transparent_63%)] blur-2xl"
        transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        animate={{ x: posture === "expansive" ? [-18, 22, -18] : [-8, 10, -8], opacity: [0.1, 0.18, 0.1] }}
        className="absolute inset-y-[12%] left-[10%] w-px bg-gradient-to-b from-transparent via-stone-100/20 to-transparent"
        transition={{ duration: 13, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        animate={{ x: posture === "tense" ? [12, -10, 12] : [8, -8, 8], opacity: [0.08, 0.15, 0.08] }}
        className="absolute inset-y-[18%] right-[14%] w-px bg-gradient-to-b from-transparent via-[#f5e4a6]/20 to-transparent"
        transition={{ duration: 11, ease: "easeInOut", repeat: Infinity }}
      />
    </div>
  )
}

function orderObjects(allObjects: ContinuityObject[], activeObject: ContinuityObject) {
  return [...allObjects].sort((a, b) => {
    if (a.id === activeObject.id) return -1
    if (b.id === activeObject.id) return 1

    const scoreA = a.weight * 0.36 + a.recency * 0.28 + a.pressure * 0.2 + relationScore(a, activeObject) * 0.16
    const scoreB = b.weight * 0.36 + b.recency * 0.28 + b.pressure * 0.2 + relationScore(b, activeObject) * 0.16

    return scoreB - scoreA
  })
}

function relationScore(object: ContinuityObject, activeObject: ContinuityObject) {
  return (object.proximity + activeObject.proximity) / 2 - Math.abs(object.pressure - activeObject.pressure) * 0.18
}

function getStateTint(state: ContinuityState) {
  switch (state) {
    case "active":
      return { core: "rgba(255,248,216,0.36)", glow: "rgba(255,236,170,0.18)" }
    case "resurfacing":
      return { core: "rgba(255,240,184,0.28)", glow: "rgba(255,225,148,0.16)" }
    case "unresolved":
      return { core: "rgba(255,222,156,0.22)", glow: "rgba(255,196,96,0.14)" }
    case "collapsing":
      return { core: "rgba(255,255,238,0.12)", glow: "rgba(255,255,238,0.06)" }
    case "resolved":
      return { core: "rgba(225,238,226,0.2)", glow: "rgba(209,238,210,0.1)" }
    case "dormant":
    default:
      return { core: "rgba(255,255,238,0.1)", glow: "rgba(255,255,238,0.05)" }
  }
}

function surfaceClass(posture: MachinePosture) {
  const spacing = posture === "expansive" ? "gap-5" : posture === "convergent" ? "gap-2" : "gap-3"

  return [
    "fixed inset-0 isolate flex h-dvh flex-col overflow-hidden bg-[#040404] text-stone-100",
    "selection:bg-[#fff6ca]/14 selection:text-[#fff9df]",
    "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(circle_at_50%_42%,rgba(255,248,216,0.07),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_25%,rgba(0,0,0,0.42))]",
    "after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.018)_1px,transparent_1px)] after:bg-[size:96px_96px] after:opacity-20",
    spacing,
  ].join(" ")
}

function railClass(posture: MachinePosture) {
  const spacing = posture === "expansive" ? "gap-8" : posture === "convergent" ? "gap-4" : posture === "hollow" ? "gap-6 opacity-80" : "gap-5"

  return [
    "relative flex min-h-[9.2rem] items-end overflow-x-auto overflow-y-hidden rounded-[2rem] border border-stone-100/[0.055]",
    "bg-black/18 px-5 pb-4 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl",
    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    spacing,
  ].join(" ")
}

function activeShellClass(state: ContinuityState) {
  const base = "absolute inset-[12%] overflow-hidden rounded-[38%] border backdrop-blur-sm"

  if (state === "unresolved") {
    return `${base} border-[#f4e0a2]/18 bg-[#fff5c8]/[0.045] shadow-[inset_0_0_42px_rgba(245,228,166,0.08)]`
  }

  if (state === "collapsing") {
    return `${base} border-stone-100/[0.07] bg-stone-100/[0.018] opacity-70`
  }

  if (state === "dormant") {
    return `${base} border-stone-100/[0.08] bg-stone-100/[0.02] opacity-75`
  }

  return `${base} border-[#fff6ca]/16 bg-[#fff8dc]/[0.035] shadow-[inset_0_0_54px_rgba(255,244,198,0.075)]`
}

function railObjectClass(state: ContinuityState, active: boolean) {
  const base = "relative block overflow-hidden rounded-[40%] border backdrop-blur-sm"
  const activeClass = active ? "border-[#fff6ca]/24" : "border-stone-100/[0.08]"

  if (state === "unresolved") {
    return `${base} ${activeClass} bg-[#fff1bc]/[0.035]`
  }

  if (state === "collapsing") {
    return `${base} ${activeClass} bg-stone-100/[0.012] opacity-70`
  }

  return `${base} ${activeClass} bg-stone-100/[0.022]`
}
