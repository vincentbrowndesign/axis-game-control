import type { AxisState } from "@/lib/engine/state"

export function StateBar({ state, status }: { state: AxisState; status?: string }) {
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
      className={`grid gap-4 rounded-lg border px-5 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center ${
        warning
          ? "border-orange-500/35 bg-orange-950/20"
          : "border-zinc-800 bg-zinc-950/70"
      }`}
    >
      <div>
        <p className="mt-1 font-mono text-5xl font-black leading-none tracking-[-0.06em] text-zinc-100">
          <span className="text-orange-300">{state.home.makes}</span>
          <span className="px-2 text-zinc-600">-</span>
          <span className="text-sky-300">{state.away.makes}</span>
        </p>
      </div>
      <div>
        <p
          className={`text-center text-5xl font-black leading-none tracking-[-0.04em] ${
            warning ? "text-orange-300" : "text-emerald-300"
          }`}
        >
          {runState}
        </p>
      </div>
      <div className="grid justify-start gap-1 sm:justify-end">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
          Flow
        </p>
        <p className="text-2xl font-black leading-none text-zinc-200">
          {status || control}
        </p>
      </div>
    </section>
  )
}
