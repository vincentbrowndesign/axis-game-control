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
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full border px-4 py-2 ${
        warning
          ? "border-orange-500/35 bg-orange-950/20"
          : "border-zinc-800 bg-zinc-950/70"
      }`}
    >
      <p
        className={`text-sm font-black uppercase tracking-[0.18em] ${
          warning ? "text-orange-300" : "text-emerald-300"
        }`}
      >
        {runState}
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-900">
        <div
          className={`h-full rounded-full ${
            warning ? "bg-orange-400/80" : "bg-emerald-300/70"
          }`}
          style={{
            width: `${Math.min(
              100,
              Math.max(16, Math.abs(state.margin) * 18 + Math.max(state.home.run, state.away.run) * 12)
            )}%`,
          }}
        />
      </div>
      <p className="max-w-28 truncate text-right text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {status || control}
      </p>
    </section>
  )
}
