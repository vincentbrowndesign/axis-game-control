import type { AxisState } from "@/lib/engine/state"

export function StateBar({ state }: { state: AxisState }) {
  const warning = state.label === "UNSTABLE" || state.label === "BREAKING"
  const control =
    state.leader === "even" ? "EVEN" : state.leader === "home" ? "HOME" : "AWAY"
  const runState =
    warning
      ? "COLD"
      : Math.max(state.home.run, state.away.run) >= 3
        ? "SPURT"
        : state.leader === "even"
          ? "EVEN"
          : "HOT"

  return (
    <section
      className={`grid gap-4 border px-4 py-4 sm:grid-cols-[1fr_1fr_1fr] sm:items-center ${
        warning
          ? "border-orange-500/35 bg-orange-950/20"
          : "border-zinc-800 bg-zinc-950/70"
      }`}
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
          Score
        </p>
        <p className="mt-1 font-mono text-5xl font-black leading-none tracking-[-0.06em] text-zinc-100">
          <span className="text-orange-300">{state.home.makes}</span>
          <span className="px-2 text-zinc-600">-</span>
          <span className="text-sky-300">{state.away.makes}</span>
        </p>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
          Control
        </p>
        <p className="mt-1 text-4xl font-black leading-none tracking-[-0.04em] text-zinc-100">
          {control}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
          Run state
        </p>
        <p
          className={`mt-1 text-4xl font-black leading-none tracking-[-0.04em] ${
            warning ? "text-orange-300" : "text-emerald-300"
          }`}
        >
          {runState}
        </p>
      </div>
    </section>
  )
}
