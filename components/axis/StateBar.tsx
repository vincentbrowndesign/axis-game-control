import type { AxisState } from "@/lib/engine/state"

export function StateBar({ state }: { state: AxisState }) {
  const warning = state.label === "UNSTABLE" || state.label === "BREAKING"

  return (
    <section
      className={`grid gap-3 border px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center ${
        warning
          ? "border-orange-500/35 bg-orange-950/20"
          : "border-zinc-800 bg-zinc-950/70"
      }`}
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
          State
        </p>
        <p
          className={`mt-1 text-4xl font-black leading-none tracking-[-0.04em] ${
            warning ? "text-orange-300" : "text-zinc-100"
          }`}
        >
          {state.label}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-right font-mono text-sm font-black text-zinc-400">
        <span>H {state.home.run}</span>
        <span>{state.margin > 0 ? "+" : ""}{state.margin}</span>
        <span>A {state.away.run}</span>
      </div>
    </section>
  )
}
