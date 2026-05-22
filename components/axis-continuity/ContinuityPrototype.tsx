"use client"

import { motion } from "framer-motion"
import { useMemo, useState } from "react"

type ContinuityState = "dormant" | "resurfacing" | "unresolved" | "collapsing" | "resolved" | "stable"
type FieldPosture = "compressed" | "open" | "tense" | "quiet" | "recovering"
type PackageMode = "Practice" | "Scout" | "Player Dev" | "Teaching"

type ContinuityMass = {
  id: string
  title: string
  caption: string
  state: ContinuityState
  weight: number
  pressure: number
  confidence: number
  replaySediment: number
  x: number
  y: number
  drift: number
  lineage: number
  inertia: number
}

const masses: ContinuityMass[] = [
  {
    id: "weak-side-return",
    title: "Weak-side return",
    caption: "Help keeps arriving late after the second side.",
    state: "stable",
    weight: 0.92,
    pressure: 0.62,
    confidence: 0.82,
    replaySediment: 0.78,
    x: 28,
    y: 36,
    drift: 0.64,
    lineage: 0.14,
    inertia: 0.82,
  },
  {
    id: "second-side-spurt",
    title: "Second-side spurt",
    caption: "The same pressure turns into quick advantage.",
    state: "resurfacing",
    weight: 0.79,
    pressure: 0.68,
    confidence: 0.72,
    replaySediment: 0.66,
    x: 42,
    y: 31,
    drift: 0.7,
    lineage: 0.24,
    inertia: 0.72,
  },
  {
    id: "late-clock-drift",
    title: "Late-clock drift",
    caption: "Spacing tightens when the touch gets late.",
    state: "unresolved",
    weight: 0.74,
    pressure: 0.88,
    confidence: 0.48,
    replaySediment: 0.58,
    x: 58,
    y: 44,
    drift: 0.86,
    lineage: 0.38,
    inertia: 0.66,
  },
  {
    id: "corner-pressure",
    title: "Corner pressure",
    caption: "Attention keeps returning to the right corner entry.",
    state: "resurfacing",
    weight: 0.68,
    pressure: 0.56,
    confidence: 0.74,
    replaySediment: 0.62,
    x: 75,
    y: 30,
    drift: 0.58,
    lineage: 0.5,
    inertia: 0.6,
  },
  {
    id: "recovery-chain",
    title: "Recovery chain",
    caption: "The shape settles after the correction.",
    state: "resolved",
    weight: 0.57,
    pressure: 0.22,
    confidence: 0.91,
    replaySediment: 0.4,
    x: 66,
    y: 63,
    drift: 0.24,
    lineage: 0.62,
    inertia: 0.76,
  },
  {
    id: "help-hesitation",
    title: "Help hesitation",
    caption: "Low signal, but the room keeps brushing it.",
    state: "dormant",
    weight: 0.39,
    pressure: 0.3,
    confidence: 0.56,
    replaySediment: 0.34,
    x: 45,
    y: 67,
    drift: 0.42,
    lineage: 0.72,
    inertia: 0.48,
  },
  {
    id: "delayed-rotation",
    title: "Delayed rotation",
    caption: "The older read is giving way to cleaner evidence.",
    state: "collapsing",
    weight: 0.44,
    pressure: 0.5,
    confidence: 0.3,
    replaySediment: 0.46,
    x: 24,
    y: 61,
    drift: 0.6,
    lineage: 0.84,
    inertia: 0.52,
  },
  {
    id: "collapse-pocket",
    title: "Collapse pocket",
    caption: "Sparse residue with enough memory to stay nearby.",
    state: "dormant",
    weight: 0.33,
    pressure: 0.34,
    confidence: 0.6,
    replaySediment: 0.3,
    x: 82,
    y: 58,
    drift: 0.5,
    lineage: 0.94,
    inertia: 0.44,
  },
]

const packageModes: PackageMode[] = ["Practice", "Scout", "Player Dev", "Teaching"]

const postureByState: Record<ContinuityState, FieldPosture> = {
  dormant: "quiet",
  resurfacing: "recovering",
  unresolved: "tense",
  collapsing: "open",
  resolved: "compressed",
  stable: "compressed",
}

export function ContinuityPrototype() {
  const [focusId, setFocusId] = useState(masses[0].id)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const [packageMode, setPackageMode] = useState<PackageMode>("Practice")
  const [groupedIds, setGroupedIds] = useState<string[]>(["weak-side-return", "second-side-spurt", "late-clock-drift"])
  const focusMass = masses.find((mass) => mass.id === focusId) ?? masses[0]
  const posture = postureByState[focusMass.state]
  const groupedMasses = groupedIds.map((id) => masses.find((mass) => mass.id === id)).filter((mass): mass is ContinuityMass => Boolean(mass))
  const fieldPressure = useMemo(() => buildFieldPressure(masses, focusMass, groupedIds), [focusMass, groupedIds])
  const packageWeight = useMemo(() => buildPackageWeight(groupedMasses), [groupedMasses])

  function toggleGrouped(id: string) {
    setGroupedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <main className={surfaceClass(posture)}>
      <SurfaceMaterial focusMass={focusMass} fieldPressure={fieldPressure} posture={posture} />

      <header className="relative z-10 flex min-h-16 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] md:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-black/70 text-[0.58rem] font-semibold tracking-[-0.02em] text-black">A</span>
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-black/58">Axis Court</span>
        </div>
        <FieldGauge fieldPressure={fieldPressure} />
      </header>

      <section className="relative z-10 grid min-h-0 flex-1 place-items-center px-3 py-2 md:px-7">
        <TacticalCourt
          fieldPressure={fieldPressure}
          focusMass={focusMass}
          groupedIds={groupedIds}
          masses={masses}
          packageWeight={packageWeight}
          posture={posture}
          pressedId={pressedId}
          setFocusId={setFocusId}
          setPressedId={setPressedId}
          toggleGrouped={toggleGrouped}
        />
      </section>

      <section className="relative z-10 px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))] md:px-7">
        <PackageComposer
          focusMass={focusMass}
          groupedMasses={groupedMasses}
          packageMode={packageMode}
          packageWeight={packageWeight}
          setPackageMode={setPackageMode}
          toggleGrouped={toggleGrouped}
        />
      </section>
    </main>
  )
}

function TacticalCourt({
  fieldPressure,
  focusMass,
  groupedIds,
  masses,
  packageWeight,
  posture,
  pressedId,
  setFocusId,
  setPressedId,
  toggleGrouped,
}: {
  fieldPressure: number
  focusMass: ContinuityMass
  groupedIds: string[]
  masses: ContinuityMass[]
  packageWeight: number
  posture: FieldPosture
  pressedId: string | null
  setFocusId: (id: string) => void
  setPressedId: (id: string | null) => void
  toggleGrouped: (id: string) => void
}) {
  return (
    <div className="relative aspect-[1.72/1] w-full max-w-6xl overflow-hidden rounded-[2rem] border-[1.5px] border-black/80 bg-[#f5f0e4] shadow-[0_24px_70px_rgba(55,44,24,0.18),inset_0_1px_0_rgba(255,255,255,0.74)]">
      <CourtGeometry fieldPressure={fieldPressure} packageWeight={packageWeight} posture={posture} />
      <ContinuityFlow focusMass={focusMass} masses={masses} />
      {masses.map((mass) => {
        const influence = calculateInfluence(mass, focusMass, groupedIds)

        return (
          <ContinuityMassNode
            focus={mass.id === focusMass.id}
            grouped={groupedIds.includes(mass.id)}
            influence={influence}
            key={mass.id}
            mass={mass}
            pressed={pressedId === mass.id}
            setFocusId={setFocusId}
            setPressedId={setPressedId}
            toggleGrouped={toggleGrouped}
          />
        )
      })}
      <ReplaySediment mass={focusMass} pressed={pressedId === focusMass.id} />
      <div className="pointer-events-none absolute bottom-5 left-5 max-w-[17rem]">
        <p className="text-sm font-medium leading-5 text-black/58">{focusMass.caption}</p>
      </div>
    </div>
  )
}

function ContinuityMassNode({
  focus,
  grouped,
  influence,
  mass,
  pressed,
  setFocusId,
  setPressedId,
  toggleGrouped,
}: {
  focus: boolean
  grouped: boolean
  influence: number
  mass: ContinuityMass
  pressed: boolean
  setFocusId: (id: string) => void
  setPressedId: (id: string | null) => void
  toggleGrouped: (id: string) => void
}) {
  const size = 4.1 + mass.weight * 3.2 + influence * 0.78
  const opacity = focus ? 1 : 0.48 + mass.weight * 0.2 + influence * 0.18
  const tone = getMassTone(mass.state)
  const tension = mass.state === "unresolved" ? ["1.2rem", "1.9rem", "1.25rem"] : ["1.55rem", "2rem", "1.55rem"]
  const driftX = (mass.drift - 0.5) * 16 * influence
  const driftY = (0.5 - mass.confidence) * 8 * influence

  return (
    <motion.button
      animate={{ opacity, x: driftX, y: driftY }}
      className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-manipulation flex-col items-center gap-2 border-0 bg-transparent p-0 text-center outline-none active:cursor-grabbing"
      drag
      dragElastic={0.07 + (1 - mass.inertia) * 0.07}
      dragMomentum={false}
      onDoubleClick={() => toggleGrouped(mass.id)}
      onDragStart={() => {
        setFocusId(mass.id)
        setPressedId(mass.id)
      }}
      onDragEnd={() => setPressedId(null)}
      onFocus={() => setFocusId(mass.id)}
      onPointerDown={() => {
        setFocusId(mass.id)
        setPressedId(mass.id)
      }}
      onPointerEnter={() => setFocusId(mass.id)}
      onPointerLeave={() => setPressedId(null)}
      onPointerUp={() => setPressedId(null)}
      style={{ left: `${mass.x}%`, top: `${mass.y}%`, width: `${size}rem` }}
      transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
      type="button"
    >
      <motion.span
        animate={{
          borderRadius: focus || influence > 0.58 ? tension : ["1.7rem", "2rem", "1.7rem"],
          scale: pressed ? 1.055 : focus ? [1, 1.012, 1] : influence > 0.52 ? [1, 1.006, 1] : 1,
        }}
        className={massShellClass(focus, grouped, mass.state)}
        style={{
          height: `${size * 0.68}rem`,
          background: `linear-gradient(145deg, ${tone.surface}, ${tone.edge}), radial-gradient(circle at ${42 + mass.drift * 12}% 48%, ${tone.pressure}, transparent 58%)`,
          boxShadow: grouped
            ? `inset 0 0 0 1px rgba(0,0,0,0.72), 0 14px 32px rgba(31,25,14,0.14), 0 0 0 ${3 + influence * 4}px rgba(0,0,0,0.045)`
            : `inset 0 0 0 1px rgba(0,0,0,0.44), 0 10px 24px rgba(31,25,14,0.1)`,
        }}
        transition={{ duration: 8 + mass.inertia * 6, ease: "easeInOut", repeat: Infinity }}
      >
        <MassInterior mass={mass} pressed={pressed} />
      </motion.span>
      <span className={massLabelClass(focus)}>{mass.title}</span>
    </motion.button>
  )
}

function PackageComposer({
  focusMass,
  groupedMasses,
  packageMode,
  packageWeight,
  setPackageMode,
  toggleGrouped,
}: {
  focusMass: ContinuityMass
  groupedMasses: ContinuityMass[]
  packageMode: PackageMode
  packageWeight: number
  setPackageMode: (mode: PackageMode) => void
  toggleGrouped: (id: string) => void
}) {
  const focusIncluded = groupedMasses.some((mass) => mass.id === focusMass.id)

  return (
    <div className="mx-auto grid max-w-6xl gap-3 rounded-[1.7rem] border border-black/12 bg-[#fffaf0]/76 p-3 shadow-[0_12px_38px_rgba(72,56,31,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl md:grid-cols-[auto_1fr_auto] md:items-center">
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {packageModes.map((mode) => (
          <button
            className={mode === packageMode ? packageModeButtonClass(true) : packageModeButtonClass(false)}
            key={mode}
            onClick={() => setPackageMode(mode)}
            type="button"
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="relative min-h-12 overflow-hidden rounded-[1.05rem] border border-black/10 bg-black/[0.035] px-3 py-2">
        <div className="absolute inset-y-0 left-0 bg-black/[0.055]" style={{ width: `${Math.max(8, packageWeight * 100)}%` }} />
        <div className="relative flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groupedMasses.map((mass) => (
            <button className="shrink-0 rounded-full border border-black/18 bg-[#f7f0df] px-3 py-1.5 text-[0.68rem] font-semibold text-black/72" key={mass.id} onClick={() => toggleGrouped(mass.id)} type="button">
              {mass.title}
            </button>
          ))}
          {groupedMasses.length === 0 ? <span className="text-xs font-medium text-black/44">Double tap court fragments to build a package.</span> : null}
        </div>
      </div>

      <button className={focusIncluded ? addButtonClass(true) : addButtonClass(false)} onClick={() => toggleGrouped(focusMass.id)} type="button">
        {focusIncluded ? "Remove focused" : "Add focused"}
      </button>
    </div>
  )
}

function CourtGeometry({
  fieldPressure,
  packageWeight,
  posture,
}: {
  fieldPressure: number
  packageWeight: number
  posture: FieldPosture
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(92,67,32,0.045)_1px,transparent_1px),linear-gradient(0deg,rgba(92,67,32,0.035)_1px,transparent_1px)] bg-[size:34px_34px]" />
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 580">
        <motion.g
          animate={{ opacity: posture === "tense" ? 0.92 : 0.78 + fieldPressure * 0.12 }}
          fill="none"
          stroke="rgba(8,8,7,0.86)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
          transition={{ duration: 0.7 }}
        >
          <path d="M500 0v580" />
          <circle cx="500" cy="290" r="72" />
          <path d="M0 84h132v412H0" />
          <path d="M1000 84H868v412h132" />
          <path d="M132 128c91 42 138 94 138 162s-47 120-138 162" />
          <path d="M868 128c-91 42-138 94-138 162s47 120 138 162" />
          <path d="M76 262a28 28 0 1 0 0 56" />
          <path d="M924 262a28 28 0 1 1 0 56" />
        </motion.g>
        <motion.g
          animate={{ opacity: 0.14 + packageWeight * 0.18 }}
          fill="none"
          stroke="rgba(8,8,7,0.62)"
          strokeLinecap="round"
          strokeWidth="2"
          transition={{ duration: 0.7 }}
        >
          <path d="M178 198C326 162 498 166 654 216" />
          <path d="M248 386C412 430 570 414 764 342" />
          <path d="M342 112C437 202 543 232 682 220" />
        </motion.g>
      </svg>
      <motion.div
        animate={{ opacity: 0.16 + fieldPressure * 0.16 }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_28%_38%,rgba(214,166,82,0.18),transparent_21%),radial-gradient(circle_at_70%_42%,rgba(12,12,10,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.3),transparent_32%,rgba(92,67,32,0.08))]"
        transition={{ duration: 0.7 }}
      />
    </div>
  )
}

function ContinuityFlow({ focusMass, masses }: { focusMass: ContinuityMass; masses: ContinuityMass[] }) {
  const related = masses.filter((mass) => mass.id !== focusMass.id && relationScore(mass, focusMass) > 0.55).slice(0, 3)

  return (
    <div className="pointer-events-none absolute inset-0">
      {related.map((mass) => {
        const relation = relationScore(mass, focusMass)
        const left = `${Math.min(focusMass.x, mass.x)}%`
        const top = `${Math.min(focusMass.y, mass.y)}%`
        const width = `${Math.abs(focusMass.x - mass.x)}%`
        const rotate = Math.atan2(mass.y - focusMass.y, mass.x - focusMass.x) * (180 / Math.PI)

        return (
          <motion.span
            animate={{ opacity: [0.03, 0.11 * relation, 0.03], scaleX: [0.88, 1.03, 0.88] }}
            className="absolute h-[2px] origin-left rounded-full bg-black/36"
            key={mass.id}
            style={{ left, top, transform: `rotate(${rotate}deg)`, width }}
            transition={{ duration: 7 + mass.inertia * 4, ease: "easeInOut", repeat: Infinity }}
          />
        )
      })}
    </div>
  )
}

function MassInterior({ mass, pressed }: { mass: ContinuityMass; pressed: boolean }) {
  const marks = [0.24, 0.4, 0.56, 0.72]

  return (
    <span className="absolute inset-[18%]">
      {marks.map((mark, index) => (
        <motion.span
          animate={{
            opacity: pressed ? [0.22, 0.56, 0.22] : [0.14, 0.27, 0.14],
            x: pressed ? [0, (mass.drift - 0.5) * 13, 0] : [0, (mass.drift - 0.5) * 5, 0],
          }}
          className="absolute h-[2px] rounded-full bg-black/36"
          key={mark}
          style={{
            left: `${14 + index * 10}%`,
            top: `${mark * 100}%`,
            width: `${24 + mass.replaySediment * 34}%`,
          }}
          transition={{ duration: 7 + index * 0.7 + mass.inertia * 2, ease: "easeInOut", repeat: Infinity }}
        />
      ))}
      <span className="absolute bottom-[10%] left-[18%] h-[2px] rounded-full bg-black/48" style={{ width: `${16 + mass.confidence * 46}%` }} />
    </span>
  )
}

function ReplaySediment({ mass, pressed }: { mass: ContinuityMass; pressed: boolean }) {
  if (!pressed) return null

  return (
    <motion.div
      animate={{ opacity: [0, 1, 1], y: [8, 0, 0] }}
      className="pointer-events-none absolute right-5 top-5 grid w-[min(18rem,42vw)] gap-2 rounded-[1.15rem] border border-black/12 bg-[#fff8e9]/80 p-3 shadow-[0_12px_32px_rgba(52,39,18,0.12)] backdrop-blur-xl"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between text-[0.56rem] uppercase tracking-[0.16em] text-black/42">
        <span>{mass.title}</span>
        <span>{Math.round(mass.replaySediment * 100)}%</span>
      </div>
      <div className="grid gap-1.5">
        {[0.24, 0.48, 0.7].map((mark, index) => (
          <span className="h-[2px] rounded-full bg-black/24" key={mark} style={{ width: `${36 + mark * 56 - index * 5}%` }} />
        ))}
      </div>
    </motion.div>
  )
}

function FieldGauge({ fieldPressure }: { fieldPressure: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Continuity field density">
      {Array.from({ length: 9 }).map((_, index) => (
        <motion.span
          animate={{ opacity: 0.16 + Math.max(0, fieldPressure - index * 0.075) }}
          className="h-1.5 w-1.5 rounded-full bg-black"
          key={index}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

function SurfaceMaterial({
  fieldPressure,
  focusMass,
  posture,
}: {
  fieldPressure: number
  focusMass: ContinuityMass
  posture: FieldPosture
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{
          opacity: posture === "quiet" ? 0.14 : posture === "tense" ? 0.24 : 0.16 + fieldPressure * 0.08,
          scale: posture === "recovering" ? [1, 1.018, 1] : posture === "tense" ? [1, 0.992, 1] : [1, 1.008, 1],
        }}
        className="absolute left-1/2 top-1/2 h-[84vmin] w-[84vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(213,166,88,0.25),transparent_67%)] blur-2xl"
        transition={{ duration: 13, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        animate={{
          x: [(focusMass.drift - 0.5) * -18, (focusMass.drift - 0.5) * 18, (focusMass.drift - 0.5) * -18],
          opacity: [0.04, 0.1 + fieldPressure * 0.05, 0.04],
        }}
        className="absolute inset-y-[10%] left-[10%] w-px bg-gradient-to-b from-transparent via-black/24 to-transparent"
        transition={{ duration: 15, ease: "easeInOut", repeat: Infinity }}
      />
    </div>
  )
}

function relationScore(mass: ContinuityMass, focusMass: ContinuityMass) {
  if (mass.id === focusMass.id) return 1

  const lineageProximity = 1 - Math.min(1, Math.abs(mass.lineage - focusMass.lineage) * 1.8)
  const courtDistance = Math.hypot((mass.x - focusMass.x) / 100, (mass.y - focusMass.y) / 100)
  const spatialProximity = 1 - Math.min(1, courtDistance * 1.7)
  const pressureSimilarity = 1 - Math.min(1, Math.abs(mass.pressure - focusMass.pressure))

  return lineageProximity * 0.38 + spatialProximity * 0.36 + pressureSimilarity * 0.26
}

function calculateInfluence(mass: ContinuityMass, focusMass: ContinuityMass, groupedIds: string[]) {
  const relation = relationScore(mass, focusMass)
  const groupForce = groupedIds.includes(mass.id) ? 0.12 : 0
  const stateForce = focusMass.state === "unresolved" ? 0.16 : focusMass.state === "resurfacing" ? 0.12 : focusMass.state === "collapsing" ? -0.08 : 0.06

  return Math.max(0, Math.min(1, relation * 0.68 + groupForce + stateForce))
}

function buildFieldPressure(allMasses: ContinuityMass[], focusMass: ContinuityMass, groupedIds: string[]) {
  const total = allMasses.reduce((sum, mass) => {
    const groupWeight = groupedIds.includes(mass.id) ? 1.18 : 1
    return sum + mass.weight * relationScore(mass, focusMass) * (0.42 + mass.pressure * 0.58) * groupWeight
  }, 0)

  return Math.min(1, total / allMasses.length + focusMass.pressure * 0.28)
}

function buildPackageWeight(groupedMasses: ContinuityMass[]) {
  if (groupedMasses.length === 0) return 0

  const total = groupedMasses.reduce((sum, mass) => sum + mass.weight * 0.44 + mass.pressure * 0.24 + mass.replaySediment * 0.32, 0)

  return Math.min(1, total / groupedMasses.length)
}

function getMassTone(state: ContinuityState) {
  switch (state) {
    case "stable":
      return { edge: "rgba(239,227,203,0.96)", pressure: "rgba(0,0,0,0.1)", surface: "rgba(255,250,239,0.98)" }
    case "resurfacing":
      return { edge: "rgba(238,219,178,0.98)", pressure: "rgba(209,151,45,0.18)", surface: "rgba(255,248,230,0.98)" }
    case "unresolved":
      return { edge: "rgba(229,203,150,0.98)", pressure: "rgba(0,0,0,0.16)", surface: "rgba(255,244,215,0.98)" }
    case "collapsing":
      return { edge: "rgba(226,219,203,0.86)", pressure: "rgba(0,0,0,0.05)", surface: "rgba(245,240,228,0.9)" }
    case "resolved":
      return { edge: "rgba(229,232,220,0.98)", pressure: "rgba(56,91,58,0.08)", surface: "rgba(251,250,239,0.98)" }
    case "dormant":
    default:
      return { edge: "rgba(231,224,207,0.9)", pressure: "rgba(0,0,0,0.04)", surface: "rgba(248,244,234,0.9)" }
  }
}

function surfaceClass(posture: FieldPosture) {
  const spacing = posture === "recovering" ? "gap-5" : posture === "compressed" ? "gap-2" : "gap-3"

  return [
    "fixed inset-0 isolate flex h-dvh flex-col overflow-hidden bg-[#f3eee2] text-black",
    "selection:bg-black/10 selection:text-black",
    "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.72),transparent_46%),linear-gradient(180deg,rgba(255,255,255,0.62),transparent_26%,rgba(190,154,95,0.12))]",
    "after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[linear-gradient(90deg,rgba(90,66,32,0.035)_1px,transparent_1px),linear-gradient(0deg,rgba(90,66,32,0.026)_1px,transparent_1px)] after:bg-[size:88px_88px] after:opacity-60",
    spacing,
  ].join(" ")
}

function massShellClass(focus: boolean, grouped: boolean, state: ContinuityState) {
  const base = "relative block overflow-hidden border backdrop-blur-sm"
  const focusClass = focus ? "border-black/86" : "border-black/38"
  const groupClass = grouped ? "ring-[3px] ring-black/12" : ""

  if (state === "unresolved") {
    return `${base} ${focusClass} ${groupClass} bg-[#fff0cf]`
  }

  if (state === "collapsing") {
    return `${base} ${focusClass} ${groupClass} bg-[#eee7d8] opacity-80`
  }

  return `${base} ${focusClass} ${groupClass} bg-[#fff8e9]`
}

function massLabelClass(focus: boolean) {
  const visibility = focus ? "text-black/82" : "text-black/54"

  return `max-w-[8rem] text-[0.66rem] font-semibold leading-3 tracking-[-0.01em] ${visibility}`
}

function packageModeButtonClass(active: boolean) {
  return [
    "shrink-0 rounded-full border px-3 py-2 text-[0.64rem] font-semibold uppercase tracking-[0.12em] transition-colors",
    active ? "border-black bg-black text-[#fff8e9]" : "border-black/14 bg-transparent text-black/48",
  ].join(" ")
}

function addButtonClass(active: boolean) {
  return [
    "rounded-full border px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition-colors",
    active ? "border-black/16 bg-black/5 text-black/62" : "border-black bg-black text-[#fff8e9]",
  ].join(" ")
}
