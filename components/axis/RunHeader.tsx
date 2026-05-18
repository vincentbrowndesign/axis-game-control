import type { Run } from "@/lib/run/runState"

export function RunHeader({
  run,
  elapsed,
  isRunning,
  onName,
  onPause,
  onResume,
  onReset,
}: {
  run: Run
  elapsed: string
  isRunning: boolean
  onName: (side: "home" | "away", value: string) => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
}) {
  return (
    <header className="grid gap-4 border-b border-zinc-800 pb-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
          Axis
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isRunning ? "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.75)]" : "bg-zinc-600"
            }`}
          />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            {isRunning ? "REC" : "PAUSE"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <input
          value={run.home}
          onChange={(event) => onName("home", event.target.value)}
          aria-label="Home"
          className="min-w-0 bg-transparent text-4xl font-black uppercase leading-none text-orange-300 outline-none sm:text-6xl"
        />
        <div className="grid justify-start gap-2 sm:justify-center">
          <div className="rounded-full border border-zinc-800 bg-black px-5 py-3 font-mono text-3xl font-black text-emerald-300 shadow-[inset_0_0_24px_rgba(39,39,42,0.65)] sm:text-4xl">
            {elapsed}
          </div>
          <div className="flex items-center justify-center gap-2">
            <ClockButton label={isRunning ? "Pause" : "Start"} onClick={isRunning ? onPause : onResume} />
            <ClockButton label="Reset" onClick={onReset} />
          </div>
        </div>
        <input
          value={run.away}
          onChange={(event) => onName("away", event.target.value)}
          aria-label="Away"
          className="min-w-0 bg-transparent text-left text-4xl font-black uppercase leading-none text-sky-300 outline-none sm:text-right sm:text-6xl"
        />
      </div>
    </header>
  )
}

function ClockButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-200"
    >
      {label}
    </button>
  )
}
