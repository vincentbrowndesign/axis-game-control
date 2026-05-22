"use client"

import { motion } from "framer-motion"
import { useMemo, useState } from "react"

type ContinuityState = "dormant" | "resurfacing" | "unresolved" | "collapsing" | "resolved" | "stable"
type FieldPosture = "compressed" | "open" | "tense" | "quiet" | "recovering"

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
    x: 41,
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
    x: 73,
    y: 30,
    drift: 0.58,
    lineage: 0.5,
    inertia: 0.6,
  },
  {
    id: "recovery-window",
    title: "Recovery window",
    caption: "The shape settles after the correction.",
    state: "resolved",
    weight: 0.57,
    pressure: 0.22,
    confidence: 0.91,
    replaySediment: 0.4,
    x: 65,
    y: 62,
    drift: 0.24,
    lineage: 0.62,
    inertia: 0.76,
  },
  {
    id: "signal-hesitation",
    title: "Signal hesitation",
    caption: "Low signal, but the room keeps brushing it.",
    state: "dormant",
    weight: 0.39,
    pressure: 0.3,
    confidence: 0.56,
    replaySediment: 0.34,
    x: 44,
    y: 67,
    drift: 0.42,
    lineage: 0.72,
    inertia: 0.48,
  },
  {
    id: "delayed-rotation-memory",
    title: "Delayed rotation memory",
    caption: "The older read is giving way to cleaner evidence.",
    state: "collapsing",
    weight: 0.44,
    pressure: 0.5,
    confidence: 0.3,
    replaySediment: 0.46,
    x: 25,
    y: 61,
    drift: 0.6,
    lineage: 0.84,
    inertia: 0.52,
  },
  {
    id: "dead-ball-window",
    title: "Dead-ball window",
    caption: "Sparse residue with enough memory to stay nearby.",
    state: "dormant",
    weight: 0.33,
    pressure: 0.34,
    confidence: 0.6,
    replaySediment: 0.3,
    x: 81,
    y: 59,
    drift: 0.5,
    lineage: 0.94,
    inertia: 0.44,
  },
]

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
  const focusMass = masses.find((mass) => mass.id === focusId) ?? masses[0]
  const posture = postureByState[focusMass.state]
  const fieldPressure = useMemo(() => buildFieldPressure(masses, focusMass), [focusMass])
  const railMasses = useMemo(() => orderMasses(masses, focusMass), [focusMass])

  return (
    <main className={surfaceClass(posture)}>
      <SurfaceAtmosphere focusMass={focusMass} fieldPressure={fieldPressure} posture={posture} />

      <header className="relative z-10 flex min-h-16 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] md:px-8">
        <div className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-stone-100/54">Axis</div>
        <FieldGauge fieldPressure={fieldPressure} />
      </header>

      <section className="relative z-10 grid min-h-0 flex-1 place-items-center px-4 py-2 md:px-8">
        <TacticalField
          fieldPressure={fieldPressure}
          focusMass={focusMass}
          masses={masses}
          posture={posture}
          pressedId={pressedId}
          setFocusId={setFocusId}
          setPressedId={setPressedId}
        />
      </section>

      <section className="relative z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-7">
        <ContinuityRail
          focusMass={focusMass}
          masses={railMasses}
          posture={posture}
          pressedId={pressedId}
          setFocusId={setFocusId}
          setPressedId={setPressedId}
        />
      </section>
    </main>
  )
}

function TacticalField({
  fieldPressure,
  focusMass,
  masses,
  posture,
  pressedId,
  setFocusId,
  setPressedId,
}: {
  fieldPressure: number
  focusMass: ContinuityMass
  masses: ContinuityMass[]
  posture: FieldPosture
  pressedId: string | null
  setFocusId: (id: string) => void
  setPressedId: (id: string | null) => void
}) {
  return (
    <div className="relative aspect-[1.72/1] w-full max-w-6xl overflow-hidden rounded-[2.2rem] border border-stone-100/[0.075] bg-[#090908]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_24px_80px_rgba(0,0,0,0.34)]">
      <CourtGeometry fieldPressure={fieldPressure} posture={posture} />
      <ContinuityFlow masses={masses} focusMass={focusMass} />
      {masses.map((mass) => {
        const influence = calculateInfluence(mass, focusMass)

        return (
          <ContinuityMassNode
            field="court"
            focus={mass.id === focusMass.id}
            influence={influence}
            key={mass.id}
            mass={mass}
            pressed={pressedId === mass.id}
            setFocusId={setFocusId}
            setPressedId={setPressedId}
          />
        )
      })}
      <ReplaySediment mass={focusMass} pressed={pressedId === focusMass.id} />
      <div className="pointer-events-none absolute bottom-5 left-5 max-w-[15rem]">
        <p className="text-xs leading-5 text-stone-100/42">{focusMass.caption}</p>
      </div>
    </div>
  )
}

function ContinuityMassNode({
  field,
  focus,
  influence,
  mass,
  pressed,
  setFocusId,
  setPressedId,
}: {
  field: "court" | "rail"
  focus: boolean
  influence: number
  mass: ContinuityMass
  pressed: boolean
  setFocusId: (id: string) => void
  setPressedId: (id: string | null) => void
}) {
  const scale = field === "court" ? 1 : 0.78
  const size = (field === "court" ? 4.1 : 3.1) + mass.weight * (field === "court" ? 3.4 : 2.4) + influence * 0.9
  const tone = getMassTone(mass.state)
  const opacity = focus ? 0.98 : 0.34 + mass.weight * 0.26 + influence * 0.22
  const tension = mass.state === "unresolved" ? ["42%", "36%", "44%", "42%"] : ["42%", "44%", "42%"]
  const driftX = (mass.drift - 0.5) * (field === "court" ? 18 : 10) * influence
  const driftY = (0.5 - mass.confidence) * (field === "court" ? 9 : 5) * influence

  return (
    <motion.button
      animate={{
        opacity,
        x: driftX,
        y: driftY,
      }}
      className={massPositionClass(field)}
      drag={field === "court"}
      dragElastic={0.08 + (1 - mass.inertia) * 0.06}
      dragMomentum={false}
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
      style={{
        left: field === "court" ? `${mass.x}%` : undefined,
        top: field === "court" ? `${mass.y}%` : undefined,
        width: `${size * scale}rem`,
      }}
      transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
      type="button"
    >
      <motion.span
        animate={{
          borderRadius: focus || influence > 0.58 ? tension : ["44%", "46%", "44%"],
          scale: pressed ? 1.08 : focus ? [1, 1.018, 1] : influence > 0.52 ? [1, 1.01, 1] : 1,
        }}
        className={massShellClass(mass.state, focus)}
        style={{
          height: `${size * scale}rem`,
          background: `radial-gradient(circle at ${44 + mass.drift * 12}% 50%, ${tone.core}, rgba(255,248,216,0.032) 58%, rgba(255,248,216,0.006) 74%)`,
          boxShadow: `inset 0 0 ${14 + mass.weight * 26}px rgba(255,248,216,0.032), 0 0 ${4 + influence * 18}px ${tone.thermal}`,
        }}
        transition={{ duration: 8 + mass.inertia * 7, ease: "easeInOut", repeat: Infinity }}
      >
        <MassInterior mass={mass} pressed={pressed} />
      </motion.span>
      <span className={massLabelClass(field, focus)}>{mass.title}</span>
    </motion.button>
  )
}

function ContinuityRail({
  focusMass,
  masses,
  posture,
  pressedId,
  setFocusId,
  setPressedId,
}: {
  focusMass: ContinuityMass
  masses: ContinuityMass[]
  posture: FieldPosture
  pressedId: string | null
  setFocusId: (id: string) => void
  setPressedId: (id: string | null) => void
}) {
  return (
    <div className="relative mx-auto flex min-h-[8.8rem] max-w-6xl items-end gap-3 overflow-x-auto overflow-y-hidden rounded-[2rem] border border-stone-100/[0.06] bg-[#080807]/62 px-5 pb-4 pt-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <RailPressureBed focusMass={focusMass} masses={masses} posture={posture} />
      {masses.map((mass) => {
        const influence = calculateInfluence(mass, focusMass)

        return (
          <ContinuityMassNode
            field="rail"
            focus={mass.id === focusMass.id}
            influence={influence}
            key={mass.id}
            mass={mass}
            pressed={pressedId === mass.id}
            setFocusId={setFocusId}
            setPressedId={setPressedId}
          />
        )
      })}
    </div>
  )
}

function CourtGeometry({ fieldPressure, posture }: { fieldPressure: number; posture: FieldPosture }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 580">
        <motion.g
          animate={{ opacity: posture === "tense" ? 0.42 : 0.28 + fieldPressure * 0.08 }}
          fill="none"
          stroke="rgba(255,248,220,0.22)"
          strokeLinecap="round"
          strokeWidth="1"
          transition={{ duration: 0.7 }}
        >
          <path d="M500 0v580" />
          <circle cx="500" cy="290" r="72" />
          <path d="M0 84h128v412H0" />
          <path d="M1000 84H872v412h128" />
          <path d="M128 126c92 43 142 95 142 164s-50 121-142 164" />
          <path d="M872 126c-92 43-142 95-142 164s50 121 142 164" />
          <path d="M72 262a28 28 0 1 0 0 56" />
          <path d="M928 262a28 28 0 1 1 0 56" />
        </motion.g>
        <motion.g
          animate={{ opacity: posture === "open" ? 0.12 : 0.18 + fieldPressure * 0.08 }}
          fill="none"
          stroke="rgba(245,226,169,0.16)"
          strokeLinecap="round"
          strokeWidth="1"
          transition={{ duration: 0.7 }}
        >
          <path d="M182 198C330 162 497 166 654 216" />
          <path d="M246 386C412 430 570 414 764 342" />
          <path d="M342 112C437 202 543 232 682 220" />
        </motion.g>
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_38%,rgba(245,226,169,0.08),transparent_22%),radial-gradient(circle_at_69%_44%,rgba(255,248,220,0.055),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_20%,rgba(0,0,0,0.16))]" />
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
            animate={{ opacity: [0.035, 0.11 * relation, 0.035], scaleX: [0.88, 1.04, 0.88] }}
            className="absolute h-px origin-left rounded-full bg-[#fff4bd]/45"
            key={mass.id}
            style={{ left, top, transform: `rotate(${rotate}deg)`, width }}
            transition={{ duration: 7 + mass.inertia * 4, ease: "easeInOut", repeat: Infinity }}
          />
        )
      })}
    </div>
  )
}

function RailPressureBed({
  focusMass,
  masses,
  posture,
}: {
  focusMass: ContinuityMass
  masses: ContinuityMass[]
  posture: FieldPosture
}) {
  return (
    <div className="pointer-events-none absolute inset-x-5 bottom-[4.65rem] top-8 z-0 overflow-hidden rounded-[1.4rem]">
      <motion.div
        animate={{
          opacity: posture === "tense" ? 0.34 : posture === "quiet" ? 0.14 : 0.24,
          scaleX: posture === "tense" ? 0.94 : posture === "recovering" ? 1.02 : 1,
        }}
        className="absolute left-2 right-2 top-1/2 h-px bg-gradient-to-r from-transparent via-[#fff4bd]/24 to-transparent"
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
      {masses.map((mass) => (
        <motion.span
          animate={{
            opacity: 0.04 + relationScore(mass, focusMass) * 0.14,
            scale: mass.id === focusMass.id ? [1, 1.1, 1] : [1, 1.02, 1],
          }}
          className="absolute top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff0b8]/10 blur-xl"
          key={mass.id}
          style={{ left: `${8 + mass.lineage * 84}%` }}
          transition={{ duration: 8 + mass.inertia * 4, ease: "easeInOut", repeat: Infinity }}
        />
      ))}
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
            opacity: pressed ? [0.1, 0.34, 0.1] : [0.07, 0.17, 0.07],
            x: pressed ? [0, (mass.drift - 0.5) * 16, 0] : [0, (mass.drift - 0.5) * 6, 0],
          }}
          className="absolute h-px rounded-full bg-[#fff8dc]/24"
          key={mark}
          style={{
            left: `${14 + index * 10}%`,
            top: `${mark * 100}%`,
            width: `${24 + mass.replaySediment * 34}%`,
          }}
          transition={{ duration: 7 + index * 0.7 + mass.inertia * 2, ease: "easeInOut", repeat: Infinity }}
        />
      ))}
      <span
        className="absolute bottom-[10%] left-[18%] h-px rounded-full bg-[#fff5c8]/28"
        style={{ width: `${16 + mass.confidence * 46}%` }}
      />
    </span>
  )
}

function ReplaySediment({ mass, pressed }: { mass: ContinuityMass; pressed: boolean }) {
  if (!pressed) return null

  return (
    <motion.div
      animate={{ opacity: [0, 1, 1], y: [8, 0, 0] }}
      className="pointer-events-none absolute right-5 top-5 grid w-[min(18rem,42vw)] gap-2 rounded-[1.2rem] border border-stone-100/[0.07] bg-black/24 p-3 backdrop-blur-xl"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between text-[0.56rem] uppercase tracking-[0.16em] text-stone-100/36">
        <span>{mass.title}</span>
        <span>{Math.round(mass.replaySediment * 100)}%</span>
      </div>
      <div className="grid gap-1.5">
        {[0.24, 0.48, 0.7].map((mark, index) => (
          <span className="h-px rounded-full bg-[#fff5c8]/25" key={mark} style={{ width: `${36 + mark * 56 - index * 5}%` }} />
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
          animate={{ opacity: 0.1 + Math.max(0, fieldPressure - index * 0.075) }}
          className="h-1 w-1 rounded-full bg-[#fff5c8]/70"
          key={index}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

function SurfaceAtmosphere({
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
          opacity: posture === "quiet" ? 0.09 : posture === "tense" ? 0.2 : 0.14 + fieldPressure * 0.05,
          scale: posture === "recovering" ? [1, 1.025, 1] : posture === "tense" ? [1, 0.99, 1] : [1, 1.01, 1],
        }}
        className="absolute left-1/2 top-1/2 h-[82vmin] w-[82vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,244,198,0.062),transparent_66%)] blur-2xl"
        transition={{ duration: 13, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        animate={{
          x: [(focusMass.drift - 0.5) * -18, (focusMass.drift - 0.5) * 18, (focusMass.drift - 0.5) * -18],
          opacity: [0.04, 0.11 + fieldPressure * 0.04, 0.04],
        }}
        className="absolute inset-y-[10%] left-[10%] w-px bg-gradient-to-b from-transparent via-stone-100/14 to-transparent"
        transition={{ duration: 15, ease: "easeInOut", repeat: Infinity }}
      />
    </div>
  )
}

function orderMasses(allMasses: ContinuityMass[], focusMass: ContinuityMass) {
  return [...allMasses].sort((a, b) => {
    if (a.id === focusMass.id) return -1
    if (b.id === focusMass.id) return 1

    const scoreA = a.weight * 0.3 + a.replaySediment * 0.2 + a.pressure * 0.16 + relationScore(a, focusMass) * 0.34
    const scoreB = b.weight * 0.3 + b.replaySediment * 0.2 + b.pressure * 0.16 + relationScore(b, focusMass) * 0.34

    return scoreB - scoreA
  })
}

function relationScore(mass: ContinuityMass, focusMass: ContinuityMass) {
  if (mass.id === focusMass.id) return 1

  const lineageProximity = 1 - Math.min(1, Math.abs(mass.lineage - focusMass.lineage) * 1.8)
  const courtDistance = Math.hypot((mass.x - focusMass.x) / 100, (mass.y - focusMass.y) / 100)
  const spatialProximity = 1 - Math.min(1, courtDistance * 1.7)
  const pressureSimilarity = 1 - Math.min(1, Math.abs(mass.pressure - focusMass.pressure))

  return lineageProximity * 0.38 + spatialProximity * 0.36 + pressureSimilarity * 0.26
}

function calculateInfluence(mass: ContinuityMass, focusMass: ContinuityMass) {
  const relation = relationScore(mass, focusMass)
  const stateForce = focusMass.state === "unresolved" ? 0.16 : focusMass.state === "resurfacing" ? 0.12 : focusMass.state === "collapsing" ? -0.08 : 0.06

  return Math.max(0, Math.min(1, relation * 0.74 + stateForce))
}

function buildFieldPressure(allMasses: ContinuityMass[], focusMass: ContinuityMass) {
  const total = allMasses.reduce((sum, mass) => sum + mass.weight * relationScore(mass, focusMass) * (0.42 + mass.pressure * 0.58), 0)

  return Math.min(1, total / allMasses.length + focusMass.pressure * 0.32)
}

function getMassTone(state: ContinuityState) {
  switch (state) {
    case "stable":
      return { core: "rgba(255,248,216,0.26)", thermal: "rgba(255,236,170,0.09)" }
    case "resurfacing":
      return { core: "rgba(255,240,184,0.23)", thermal: "rgba(255,225,148,0.1)" }
    case "unresolved":
      return { core: "rgba(255,222,156,0.2)", thermal: "rgba(255,196,96,0.09)" }
    case "collapsing":
      return { core: "rgba(255,255,238,0.075)", thermal: "rgba(255,255,238,0.026)" }
    case "resolved":
      return { core: "rgba(230,238,226,0.15)", thermal: "rgba(210,238,210,0.05)" }
    case "dormant":
    default:
      return { core: "rgba(255,255,238,0.066)", thermal: "rgba(255,255,238,0.026)" }
  }
}

function surfaceClass(posture: FieldPosture) {
  const spacing = posture === "recovering" ? "gap-5" : posture === "compressed" ? "gap-2" : "gap-3"

  return [
    "fixed inset-0 isolate flex h-dvh flex-col overflow-hidden bg-[#050504] text-stone-100",
    "selection:bg-[#fff6ca]/14 selection:text-[#fff9df]",
    "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(circle_at_50%_42%,rgba(255,248,216,0.047),transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.028),transparent_25%,rgba(0,0,0,0.5))]",
    "after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[linear-gradient(90deg,rgba(255,255,255,0.014)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.01)_1px,transparent_1px)] after:bg-[size:120px_120px] after:opacity-18",
    spacing,
  ].join(" ")
}

function massPositionClass(field: "court" | "rail") {
  const base = "group z-10 flex shrink-0 touch-manipulation flex-col items-center gap-2 border-0 bg-transparent p-0 text-center outline-none"

  if (field === "court") {
    return `${base} absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing`
  }

  return `${base} relative`
}

function massShellClass(state: ContinuityState, focus: boolean) {
  const base = "relative block overflow-hidden border backdrop-blur-sm"
  const focusClass = focus ? "border-[#fff6ca]/22" : "border-stone-100/[0.07]"

  if (state === "unresolved") {
    return `${base} ${focusClass} bg-[#fff1bc]/[0.028]`
  }

  if (state === "collapsing") {
    return `${base} ${focusClass} bg-stone-100/[0.008] opacity-72`
  }

  return `${base} ${focusClass} bg-stone-100/[0.016]`
}

function massLabelClass(field: "court" | "rail", focus: boolean) {
  const visibility = focus ? "text-stone-100/68" : "text-stone-100/34"

  if (field === "court") {
    return `max-w-[8rem] text-[0.64rem] font-medium leading-3 tracking-[-0.01em] ${visibility}`
  }

  return `max-w-[5.8rem] truncate text-[0.56rem] uppercase tracking-[0.1em] ${visibility}`
}
