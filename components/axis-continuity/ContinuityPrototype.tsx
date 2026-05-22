"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"

type ContinuityState = "active" | "dormant" | "resurfacing" | "unresolved" | "collapsing" | "resolved"
type MachinePosture = "convergent" | "expansive" | "tense" | "hollow" | "resurgent"

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
  lineage: number
  drift: number
}

const objects: ContinuityObject[] = [
  {
    id: "weak-side-return",
    title: "Weak-side return",
    caption: "The help shape keeps returning after the second reversal.",
    state: "active",
    weight: 0.92,
    pressure: 0.62,
    health: 0.78,
    recency: 0.86,
    proximity: 0.98,
    pulse: 7.8,
    memory: "8 touches / 3 rewinds",
    lineage: 0.14,
    drift: 0.72,
  },
  {
    id: "second-side-spurt",
    title: "Second-side spurt",
    caption: "The next object inherits pressure from the weak-side return.",
    state: "resurfacing",
    weight: 0.79,
    pressure: 0.66,
    health: 0.72,
    recency: 0.77,
    proximity: 0.9,
    pulse: 8.4,
    memory: "paired pulse",
    lineage: 0.22,
    drift: 0.68,
  },
  {
    id: "late-clock-drift",
    title: "Late-clock drift",
    caption: "Spacing softens when the possession narrows.",
    state: "unresolved",
    weight: 0.71,
    pressure: 0.84,
    health: 0.48,
    recency: 0.72,
    proximity: 0.82,
    pulse: 9.4,
    memory: "unresolved",
    lineage: 0.36,
    drift: 0.84,
  },
  {
    id: "corner-pressure",
    title: "Corner pressure",
    caption: "Attention keeps waking around the right-corner entry.",
    state: "resurfacing",
    weight: 0.66,
    pressure: 0.58,
    health: 0.7,
    recency: 0.94,
    proximity: 0.68,
    pulse: 7.1,
    memory: "waking",
    lineage: 0.48,
    drift: 0.58,
  },
  {
    id: "recovery-window",
    title: "Recovery window",
    caption: "The correction stabilizes the same relationship later.",
    state: "resolved",
    weight: 0.58,
    pressure: 0.18,
    health: 0.92,
    recency: 0.48,
    proximity: 0.47,
    pulse: 11.4,
    memory: "resolved",
    lineage: 0.6,
    drift: 0.22,
  },
  {
    id: "signal-hesitation",
    title: "Signal hesitation",
    caption: "A low-signal fragment keeps catching the edge of attention.",
    state: "dormant",
    weight: 0.38,
    pressure: 0.26,
    health: 0.64,
    recency: 0.31,
    proximity: 0.54,
    pulse: 12.6,
    memory: "low signal",
    lineage: 0.7,
    drift: 0.4,
  },
  {
    id: "delayed-rotation-memory",
    title: "Delayed rotation memory",
    caption: "The object is losing shape as better evidence takes over.",
    state: "collapsing",
    weight: 0.43,
    pressure: 0.52,
    health: 0.27,
    recency: 0.4,
    proximity: 0.33,
    pulse: 10.2,
    memory: "fading",
    lineage: 0.82,
    drift: 0.61,
  },
  {
    id: "dead-ball-window",
    title: "Dead-ball window",
    caption: "Sparse residue with enough proximity to stay in the field.",
    state: "dormant",
    weight: 0.31,
    pressure: 0.34,
    health: 0.59,
    recency: 0.28,
    proximity: 0.76,
    pulse: 13.8,
    memory: "waiting",
    lineage: 0.92,
    drift: 0.5,
  },
]

const postureByState: Record<ContinuityState, MachinePosture> = {
  active: "convergent",
  dormant: "hollow",
  resurfacing: "resurgent",
  unresolved: "tense",
  collapsing: "hollow",
  resolved: "convergent",
}

export function ContinuityPrototype() {
  const [activeId, setActiveId] = useState(objects[0].id)
  const [decompressedId, setDecompressedId] = useState<string | null>(null)
  const activeObject = objects.find((object) => object.id === activeId) ?? objects[0]
  const posture = postureByState[activeObject.state]
  const railObjects = useMemo(() => orderObjects(objects, activeObject), [activeObject])
  const activeIndex = railObjects.findIndex((object) => object.id === activeObject.id)
  const fieldPressure = useMemo(() => buildFieldPressure(railObjects, activeObject), [activeObject, railObjects])
  const isDecompressed = decompressedId === activeObject.id

  return (
    <main className={surfaceClass(posture)}>
      <Atmosphere activeObject={activeObject} fieldPressure={fieldPressure} posture={posture} />

      <header className="relative z-10 flex min-h-16 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] md:px-8">
        <FieldGauge fieldPressure={fieldPressure} />
      </header>

      <section className="relative z-10 grid min-h-0 flex-1 place-items-center px-5 py-4">
        <AnimatePresence mode="wait">
          <ActiveContinuityObject
            decompressed={isDecompressed}
            key={activeObject.id}
            object={activeObject}
            posture={posture}
            onToggleDecompression={() => setDecompressedId(isDecompressed ? null : activeObject.id)}
          />
        </AnimatePresence>
      </section>

      <section className="relative z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-7">
        <div className="mx-auto max-w-6xl">
          <div className={railClass(posture)}>
            <RailSubstrate objects={railObjects} activeObject={activeObject} posture={posture} />
            {railObjects.map((object, index) => {
              const influence = calculateInfluence(object, activeObject, index, activeIndex, posture)

              return (
                <RailObject
                  active={object.id === activeObject.id}
                  index={index}
                  influence={influence}
                  key={object.id}
                  object={object}
                  onSelect={() => setActiveId(object.id)}
                />
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}

function ActiveContinuityObject({
  decompressed,
  object,
  posture,
  onToggleDecompression,
}: {
  decompressed: boolean
  object: ContinuityObject
  posture: MachinePosture
  onToggleDecompression: () => void
}) {
  const stateTint = getStateTint(object.state)
  const pressureScale = 0.94 + object.pressure * 0.05
  const edgeOpacity = 0.22 + object.health * 0.34
  const thermalDuration = object.pulse + object.drift * 2.2

  return (
    <motion.button
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative grid aspect-square w-[min(72vw,30rem)] touch-manipulation place-items-center border-0 bg-transparent p-0 text-center outline-none"
      exit={{ opacity: 0, scale: 0.982, y: 10 }}
      initial={{ opacity: 0, scale: 0.982, y: 10 }}
      onClick={onToggleDecompression}
      transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
      type="button"
    >
      <motion.span
        animate={{
          opacity: [edgeOpacity * 0.7, edgeOpacity, edgeOpacity * 0.7],
          scale: decompressed ? [1.02, 1.075, 1.02] : [pressureScale, pressureScale + 0.018, pressureScale],
        }}
        className="absolute inset-[6%] rounded-[42%] border border-stone-100/[0.07]"
        style={{
          background: `radial-gradient(circle at 48% 48%, ${stateTint.core}, transparent 48%), radial-gradient(circle at 50% 50%, rgba(255,255,238,0.045), rgba(255,255,238,0.012) 58%, transparent 72%)`,
          boxShadow: `inset 0 0 ${32 + object.weight * 32}px rgba(255,248,216,0.035), 0 0 ${18 + object.weight * 32}px ${stateTint.thermal}`,
        }}
        transition={{ duration: thermalDuration, ease: "easeInOut", repeat: Infinity }}
      />

      <motion.span
        animate={{
          borderRadius: posture === "tense" ? ["39%", "35%", "41%", "39%"] : ["39%", "42%", "39%"],
          rotate: posture === "tense" ? [0, 0.24, -0.18, 0] : [0, 0.12, 0],
        }}
        className={activeShellClass(object.state, decompressed)}
        transition={{ duration: thermalDuration * 1.2, ease: "easeInOut", repeat: Infinity }}
      >
        <span className="absolute inset-[10%] rounded-[38%] border border-stone-100/[0.075] opacity-70" />
        <span className="absolute inset-[21%] rounded-[45%] border border-[#f5e4a6]/[0.08] opacity-80" />
        <span className="absolute inset-[34%] rounded-full bg-[#fff8d8]/[0.045] blur-md" />
        <ObjectSignature object={object} expanded={decompressed} />
        {decompressed ? <ReplayMemory object={object} /> : null}
      </motion.span>

      <div className="relative z-10 grid max-w-[19rem] gap-4">
        <div className="mx-auto flex items-center gap-2 text-[0.58rem] uppercase tracking-[0.16em] text-stone-100/34">
          <span>{object.memory}</span>
          <span className="h-px w-6 bg-stone-100/10" />
          <span>{Math.round(object.weight * 100)}w</span>
        </div>
        <h1 className="text-balance text-3xl font-medium leading-[0.95] tracking-[-0.035em] text-[#fff9df]/90 sm:text-5xl">{object.title}</h1>
        <p className="mx-auto max-w-[17rem] text-sm leading-5 text-stone-200/46 sm:text-base">{object.caption}</p>
      </div>
    </motion.button>
  )
}

function RailObject({
  active,
  index,
  influence,
  object,
  onSelect,
}: {
  active: boolean
  index: number
  influence: number
  object: ContinuityObject
  onSelect: () => void
}) {
  const size = 3.05 + object.weight * 2.15 + influence * 0.58
  const opacity = active ? 1 : 0.2 + object.weight * 0.36 + influence * 0.24
  const stateTint = getStateTint(object.state)
  const xShift = (object.drift - 0.5) * 8 + influence * (object.pressure > 0.6 ? -5 : 3)
  const yShift = active ? -10 : -2 - influence * 7

  return (
    <motion.button
      animate={{
        opacity,
        x: xShift,
        y: yShift,
      }}
      className="group relative z-10 flex shrink-0 touch-manipulation flex-col items-center gap-3 border-0 bg-transparent p-0 text-left outline-none"
      initial={false}
      onClick={onSelect}
      style={{ width: `${size + 1.5}rem` }}
      transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
      type="button"
    >
      <motion.span
        animate={{
          borderRadius: active || influence > 0.5 ? ["40%", "36%", "41%", "40%"] : ["40%", "42%", "40%"],
          scale: active ? [1, 1.028, 1] : influence > 0.45 ? [1, 1.014, 1] : 1,
        }}
        className={railObjectClass(object.state, active)}
        style={{
          height: `${size}rem`,
          width: `${size}rem`,
          background: `radial-gradient(circle at ${46 + object.drift * 12}% 50%, ${stateTint.core}, rgba(255,255,238,0.024) 56%, rgba(255,255,238,0.004) 74%)`,
          boxShadow: `inset 0 0 ${16 + object.weight * 22}px rgba(255,248,216,0.026), 0 0 ${6 + influence * 20}px ${stateTint.thermal}`,
        }}
        transition={{ duration: object.pulse + index * 0.28, ease: "easeInOut", repeat: Infinity }}
      >
        <ObjectSignature object={object} />
        <span
          className="absolute bottom-[17%] left-[18%] h-px rounded-full bg-[#fff6ca]/28"
          style={{ width: `${16 + object.health * 48}%` }}
        />
      </motion.span>
      <span className="max-w-[5.8rem] truncate text-[0.56rem] uppercase tracking-[0.1em] text-stone-100/30 group-focus-visible:text-stone-100/82">
        {object.title}
      </span>
    </motion.button>
  )
}

function RailSubstrate({
  activeObject,
  objects,
  posture,
}: {
  activeObject: ContinuityObject
  objects: ContinuityObject[]
  posture: MachinePosture
}) {
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-[4.8rem] top-7 z-0 overflow-hidden rounded-[1.6rem]">
      <motion.div
        animate={{
          opacity: posture === "hollow" ? 0.18 : posture === "tense" ? 0.38 : 0.28,
          scaleX: posture === "tense" ? 0.96 : posture === "resurgent" ? 1.025 : 1,
        }}
        className="absolute left-3 right-3 top-1/2 h-px bg-gradient-to-r from-transparent via-[#fff6ca]/22 to-transparent"
        transition={{ duration: 0.74, ease: [0.16, 1, 0.3, 1] }}
      />
      {objects.map((object) => {
        const relation = relationScore(object, activeObject)
        const left = `${7 + object.lineage * 86}%`

        return (
          <motion.span
            animate={{
              opacity: 0.06 + relation * 0.18,
              scale: object.id === activeObject.id ? [1, 1.08, 1] : [1, 1.025, 1],
            }}
            className="absolute top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff0b8]/12 blur-xl"
            key={object.id}
            style={{ left }}
            transition={{ duration: object.pulse, ease: "easeInOut", repeat: Infinity }}
          />
        )
      })}
    </div>
  )
}

function ObjectSignature({ expanded = false, object }: { expanded?: boolean; object: ContinuityObject }) {
  const bars = [0.22, 0.36, 0.5, 0.64, 0.78]

  return (
    <span className="absolute inset-[18%] opacity-70">
      {bars.map((bar, index) => (
        <motion.span
          animate={{
            opacity: expanded ? [0.12, 0.34, 0.12] : [0.08, 0.18, 0.08],
            x: expanded ? [0, (object.drift - 0.5) * 18, 0] : [0, (object.drift - 0.5) * 8, 0],
          }}
          className="absolute h-px rounded-full bg-[#fff8dc]/24"
          key={bar}
          style={{
            left: `${14 + index * 11}%`,
            top: `${bar * 100}%`,
            width: `${24 + object.weight * 30}%`,
          }}
          transition={{ duration: object.pulse + index * 0.52, ease: "easeInOut", repeat: Infinity }}
        />
      ))}
    </span>
  )
}

function ReplayMemory({ object }: { object: ContinuityObject }) {
  const marks = [0.18, 0.31, 0.44, 0.63, 0.78]

  return (
    <span className="absolute inset-[14%] rounded-[36%]">
      {marks.map((mark, index) => (
        <motion.span
          animate={{ opacity: [0.1, 0.32, 0.1], scaleX: [0.86, 1.1, 0.86] }}
          className="absolute left-[18%] h-px rounded-full bg-[#fff6ca]/30"
          key={mark}
          style={{
            top: `${mark * 100}%`,
            width: `${26 + object.weight * 34 - index * 2}%`,
          }}
          transition={{ duration: 2.8 + index * 0.42, ease: "easeInOut", repeat: Infinity }}
        />
      ))}
    </span>
  )
}

function FieldGauge({ fieldPressure }: { fieldPressure: number }) {
  return (
    <div className="ml-auto flex items-center gap-1.5" aria-label="Continuity field density">
      {Array.from({ length: 9 }).map((_, index) => (
        <motion.span
          animate={{ opacity: 0.12 + Math.max(0, fieldPressure - index * 0.07) }}
          className="h-1 w-1 rounded-full bg-[#fff5c8]/70"
          key={index}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

function Atmosphere({
  activeObject,
  fieldPressure,
  posture,
}: {
  activeObject: ContinuityObject
  fieldPressure: number
  posture: MachinePosture
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{
          opacity: posture === "hollow" ? 0.1 : posture === "tense" ? 0.24 : 0.18 + fieldPressure * 0.07,
          scale: posture === "resurgent" ? [1, 1.04, 1] : posture === "tense" ? [1, 0.985, 1] : [1, 1.014, 1],
        }}
        className="absolute left-1/2 top-1/2 h-[76vmin] w-[76vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,244,198,0.075),transparent_64%)] blur-2xl"
        transition={{ duration: 12, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        animate={{
          x: [(activeObject.drift - 0.5) * -24, (activeObject.drift - 0.5) * 24, (activeObject.drift - 0.5) * -24],
          opacity: posture === "hollow" ? [0.06, 0.1, 0.06] : [0.08, 0.16 + fieldPressure * 0.06, 0.08],
        }}
        className="absolute inset-y-[12%] left-[12%] w-px bg-gradient-to-b from-transparent via-stone-100/18 to-transparent"
        transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        animate={{
          x: posture === "tense" ? [14, -12, 14] : [8, -8, 8],
          opacity: [0.05, 0.13 + activeObject.pressure * 0.06, 0.05],
        }}
        className="absolute inset-y-[18%] right-[16%] w-px bg-gradient-to-b from-transparent via-[#f5e4a6]/18 to-transparent"
        transition={{ duration: 12, ease: "easeInOut", repeat: Infinity }}
      />
    </div>
  )
}

function orderObjects(allObjects: ContinuityObject[], activeObject: ContinuityObject) {
  return [...allObjects].sort((a, b) => {
    if (a.id === activeObject.id) return -1
    if (b.id === activeObject.id) return 1

    const scoreA = a.weight * 0.32 + a.recency * 0.2 + a.pressure * 0.18 + relationScore(a, activeObject) * 0.3
    const scoreB = b.weight * 0.32 + b.recency * 0.2 + b.pressure * 0.18 + relationScore(b, activeObject) * 0.3

    return scoreB - scoreA
  })
}

function relationScore(object: ContinuityObject, activeObject: ContinuityObject) {
  const lineageProximity = 1 - Math.min(1, Math.abs(object.lineage - activeObject.lineage) * 1.8)
  const pressureSimilarity = 1 - Math.min(1, Math.abs(object.pressure - activeObject.pressure))

  return object.id === activeObject.id ? 1 : lineageProximity * 0.52 + object.proximity * 0.3 + pressureSimilarity * 0.18
}

function calculateInfluence(
  object: ContinuityObject,
  activeObject: ContinuityObject,
  index: number,
  activeIndex: number,
  posture: MachinePosture,
) {
  const railDistance = Math.min(1, Math.abs(index - activeIndex) / 5)
  const postureForce = posture === "tense" ? 0.18 : posture === "resurgent" ? 0.14 : posture === "hollow" ? -0.08 : 0.08
  const relation = relationScore(object, activeObject)

  return Math.max(0, Math.min(1, relation * 0.68 + (1 - railDistance) * 0.22 + postureForce))
}

function buildFieldPressure(railObjects: ContinuityObject[], activeObject: ContinuityObject) {
  const total = railObjects.reduce((sum, object) => sum + object.weight * relationScore(object, activeObject) * (0.4 + object.pressure * 0.6), 0)

  return Math.min(1, total / railObjects.length + activeObject.pressure * 0.34)
}

function getStateTint(state: ContinuityState) {
  switch (state) {
    case "active":
      return { core: "rgba(255,248,216,0.28)", thermal: "rgba(255,236,170,0.1)" }
    case "resurfacing":
      return { core: "rgba(255,240,184,0.24)", thermal: "rgba(255,225,148,0.12)" }
    case "unresolved":
      return { core: "rgba(255,222,156,0.2)", thermal: "rgba(255,196,96,0.1)" }
    case "collapsing":
      return { core: "rgba(255,255,238,0.08)", thermal: "rgba(255,255,238,0.035)" }
    case "resolved":
      return { core: "rgba(225,238,226,0.16)", thermal: "rgba(209,238,210,0.06)" }
    case "dormant":
    default:
      return { core: "rgba(255,255,238,0.07)", thermal: "rgba(255,255,238,0.03)" }
  }
}

function surfaceClass(posture: MachinePosture) {
  const spacing = posture === "resurgent" ? "gap-5" : posture === "convergent" ? "gap-2" : "gap-3"

  return [
    "fixed inset-0 isolate flex h-dvh flex-col overflow-hidden bg-[#040404] text-stone-100",
    "selection:bg-[#fff6ca]/14 selection:text-[#fff9df]",
    "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(circle_at_50%_42%,rgba(255,248,216,0.055),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.028),transparent_25%,rgba(0,0,0,0.48))]",
    "after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.012)_1px,transparent_1px)] after:bg-[size:112px_112px] after:opacity-20",
    spacing,
  ].join(" ")
}

function railClass(posture: MachinePosture) {
  const spacing = posture === "resurgent" ? "gap-6" : posture === "convergent" ? "gap-3" : posture === "hollow" ? "gap-5 opacity-82" : "gap-4"

  return [
    "relative flex min-h-[9.4rem] items-end overflow-x-auto overflow-y-hidden rounded-[2rem] border border-stone-100/[0.045]",
    "bg-black/16 px-5 pb-4 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-xl",
    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    spacing,
  ].join(" ")
}

function activeShellClass(state: ContinuityState, decompressed: boolean) {
  const base = "absolute overflow-hidden border backdrop-blur-sm"
  const inset = decompressed ? "inset-[8%]" : "inset-[12%]"

  if (state === "unresolved") {
    return `${base} ${inset} border-[#f4e0a2]/14 bg-[#fff5c8]/[0.035] shadow-[inset_0_0_42px_rgba(245,228,166,0.06)]`
  }

  if (state === "collapsing") {
    return `${base} ${inset} border-stone-100/[0.055] bg-stone-100/[0.012] opacity-70`
  }

  if (state === "dormant") {
    return `${base} ${inset} border-stone-100/[0.065] bg-stone-100/[0.014] opacity-74`
  }

  return `${base} ${inset} border-[#fff6ca]/12 bg-[#fff8dc]/[0.025] shadow-[inset_0_0_50px_rgba(255,244,198,0.045)]`
}

function railObjectClass(state: ContinuityState, active: boolean) {
  const base = "relative block overflow-hidden border backdrop-blur-sm"
  const activeClass = active ? "border-[#fff6ca]/20" : "border-stone-100/[0.065]"

  if (state === "unresolved") {
    return `${base} ${activeClass} bg-[#fff1bc]/[0.026]`
  }

  if (state === "collapsing") {
    return `${base} ${activeClass} bg-stone-100/[0.008] opacity-70`
  }

  return `${base} ${activeClass} bg-stone-100/[0.016]`
}
