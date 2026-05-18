import type { SignalSide } from "@/lib/run/signals"

export function ControlPad({
  home,
  away,
  onSignal,
}: {
  home: string
  away: string
  onSignal: (side: SignalSide) => void
}) {
  return (
    <section className="grid gap-3">
      <TeamSignal side="home" label={home} onSignal={onSignal} />
      <TeamSignal side="away" label={away} onSignal={onSignal} />
    </section>
  )
}

function TeamSignal({
  side,
  label,
  onSignal,
}: {
  side: SignalSide
  label: string
  onSignal: (side: SignalSide) => void
}) {
  const classes =
    side === "home"
      ? "border-orange-400/70 bg-orange-400 text-black hover:bg-orange-300"
      : "border-sky-400/70 bg-sky-400 text-black hover:bg-sky-300"

  return (
    <button
      type="button"
      onClick={() => onSignal(side)}
      className={`min-h-48 rounded-lg border p-6 text-left transition active:scale-[0.99] sm:min-h-64 ${classes}`}
    >
      <span className="block text-xs font-black uppercase tracking-[0.22em] opacity-65">
        Signal
      </span>
      <span className="mt-10 block truncate text-6xl font-black uppercase leading-none tracking-[-0.06em] sm:text-8xl">
        {label}
      </span>
    </button>
  )
}
