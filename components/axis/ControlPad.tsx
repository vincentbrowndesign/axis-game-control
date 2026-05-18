import type { SignalResult, SignalSide } from "@/lib/run/signals"

export function ControlPad({
  home,
  away,
  onSignal,
}: {
  home: string
  away: string
  onSignal: (side: SignalSide, result: SignalResult) => void
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <TeamSignal side="home" result="make" label={`${home} make`} onSignal={onSignal} />
      <TeamSignal side="home" result="miss" label={`${home} miss`} onSignal={onSignal} />
      <TeamSignal side="away" result="make" label={`${away} make`} onSignal={onSignal} />
      <TeamSignal side="away" result="miss" label={`${away} miss`} onSignal={onSignal} />
    </section>
  )
}

function TeamSignal({
  side,
  result,
  label,
  onSignal,
}: {
  side: SignalSide
  result: SignalResult
  label: string
  onSignal: (side: SignalSide, result: SignalResult) => void
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
      className={`min-h-36 rounded-lg border p-5 text-left transition active:scale-[0.99] sm:min-h-48 ${classes}`}
    >
      <span className="block text-xs font-black uppercase tracking-[0.22em] opacity-65">
        {side}
      </span>
      <span className="mt-8 block truncate text-5xl font-black uppercase leading-none tracking-[-0.06em] sm:text-6xl">
        {result}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
