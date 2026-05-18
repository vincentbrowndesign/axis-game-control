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
      <SignalButton
        side="home"
        result="make"
        label={`${home} make`}
        tone="home"
        onSignal={onSignal}
      />
      <SignalButton
        side="away"
        result="make"
        label={`${away} make`}
        tone="away"
        onSignal={onSignal}
      />
      <SignalButton
        side="home"
        result="miss"
        label={`${home} miss`}
        tone="darkHome"
        onSignal={onSignal}
      />
      <SignalButton
        side="away"
        result="miss"
        label={`${away} miss`}
        tone="darkAway"
        onSignal={onSignal}
      />
    </section>
  )
}

function SignalButton({
  side,
  result,
  label,
  tone,
  onSignal,
}: {
  side: SignalSide
  result: SignalResult
  label: string
  tone: "home" | "away" | "darkHome" | "darkAway"
  onSignal: (side: SignalSide, result: SignalResult) => void
}) {
  const classes = {
    home: "bg-orange-400 text-black hover:bg-orange-300",
    away: "bg-sky-400 text-black hover:bg-sky-300",
    darkHome:
      "border border-orange-400/20 bg-orange-950/20 text-orange-200 hover:bg-orange-900/30",
    darkAway:
      "border border-sky-400/20 bg-sky-950/20 text-sky-200 hover:bg-sky-900/30",
  }[tone]

  return (
    <button
      type="button"
      onClick={() => onSignal(side, result)}
      className={`min-h-36 rounded-lg p-5 text-left transition active:scale-[0.99] sm:min-h-44 ${classes}`}
    >
      <span className="block text-xs font-black uppercase tracking-[0.2em] opacity-70">
        {side}
      </span>
      <span className="mt-8 block text-5xl font-black uppercase leading-none tracking-[-0.05em] sm:text-6xl">
        {result}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
