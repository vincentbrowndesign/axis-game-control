import type { SignalResult, SignalSide } from "@/lib/run/signals"

export function ControlPad({
  home,
  away,
  onSignal,
  onUndo,
}: {
  home: string
  away: string
  onSignal: (side: SignalSide, result: SignalResult) => void
  onUndo: () => void
}) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TeamLane homeAway="home" name={home} onSignal={onSignal} />
        <TeamLane homeAway="away" name={away} onSignal={onSignal} />
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="mx-auto h-16 w-full max-w-sm rounded-full border border-zinc-700 bg-zinc-950 text-sm font-black uppercase tracking-[0.22em] text-zinc-300 transition active:scale-[0.99] hover:border-zinc-500 hover:text-white"
      >
        Undo
      </button>
    </section>
  )
}

function TeamLane({
  homeAway,
  name,
  onSignal,
}: {
  homeAway: SignalSide
  name: string
  onSignal: (side: SignalSide, result: SignalResult) => void
}) {
  return (
    <div className="grid gap-2">
      <TeamSignal
        side={homeAway}
        result="make"
        label={`${name} make`}
        name={name}
        onSignal={onSignal}
        size="primary"
      />
      <TeamSignal
        side={homeAway}
        result="miss"
        label={`${name} miss`}
        name={name}
        onSignal={onSignal}
        size="secondary"
      />
    </div>
  )
}

function TeamSignal({
  side,
  result,
  label,
  name,
  onSignal,
  size,
}: {
  side: SignalSide
  result: SignalResult
  label: string
  name: string
  onSignal: (side: SignalSide, result: SignalResult) => void
  size: "primary" | "secondary"
}) {
  const makeTone =
    side === "home"
      ? "border-orange-400/70 bg-orange-400 text-black hover:bg-orange-300"
      : "border-sky-400/70 bg-sky-400 text-black hover:bg-sky-300"
  const missTone =
    side === "home"
      ? "border-orange-400/25 bg-orange-950/30 text-orange-200 hover:bg-orange-900/40"
      : "border-sky-400/25 bg-sky-950/30 text-sky-200 hover:bg-sky-900/40"
  const classes = result === "make" ? makeTone : missTone

  return (
    <button
      type="button"
      onClick={() => onSignal(side, result)}
      className={`rounded-lg border p-5 text-left transition active:scale-[0.99] ${
        size === "primary" ? "min-h-44 sm:min-h-56" : "min-h-24 sm:min-h-28"
      } ${classes}`}
    >
      <span className="block text-xs font-black uppercase tracking-[0.22em] opacity-65">
        {name}
      </span>
      <span
        className={`block truncate font-black uppercase leading-none tracking-[-0.04em] ${
          size === "primary" ? "mt-8 text-5xl sm:text-7xl" : "mt-4 text-3xl sm:text-4xl"
        }`}
      >
        {result}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
