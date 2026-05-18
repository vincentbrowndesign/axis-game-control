import type { Run, RunMedia } from "@/lib/run/runState"

export function RunHeader({
  run,
  elapsed,
  isRunning,
  homeScore,
  awayScore,
  media,
  onName,
  onPause,
  onResume,
  onReset,
}: {
  run: Run
  elapsed: string
  isRunning: boolean
  homeScore: number
  awayScore: number
  media?: RunMedia
  onName: (side: "home" | "away", value: string) => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
}) {
  return (
    <header className="grid gap-3 border-b border-zinc-800 pb-3">
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

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3 shadow-[inset_0_0_24px_rgba(39,39,42,0.45)]">
        <input
          value={run.home}
          onChange={(event) => onName("home", event.target.value)}
          aria-label="Home"
          className="min-w-0 bg-transparent text-left text-lg font-black uppercase leading-none text-orange-300 outline-none sm:text-2xl"
        />
        <div className="grid min-w-24 justify-items-center gap-1">
          <div className="font-mono text-3xl font-black leading-none tracking-[-0.05em] text-zinc-100 sm:text-4xl">
            <span className="text-orange-300">{homeScore}</span>
            <span className="px-1 text-zinc-600">-</span>
            <span className="text-sky-300">{awayScore}</span>
          </div>
          <div className="rounded-full border border-zinc-800 bg-black px-3 py-1 font-mono text-sm font-black text-emerald-300 sm:text-base">
            {elapsed}
          </div>
        </div>
        <input
          value={run.away}
          onChange={(event) => onName("away", event.target.value)}
          aria-label="Away"
          className="min-w-0 bg-transparent text-right text-lg font-black uppercase leading-none text-sky-300 outline-none sm:text-2xl"
        />
      </div>

      <ActiveMediaStrip media={media} />

      <div className="flex items-center justify-center gap-2">
        <ClockButton label={isRunning ? "Pause" : "Start"} onClick={isRunning ? onPause : onResume} />
        <ClockButton label="Reset" onClick={onReset} />
      </div>
    </header>
  )
}

function ActiveMediaStrip({ media }: { media?: RunMedia }) {
  const duration = media?.durationSeconds
    ? `${Math.max(0, Math.round(media.durationSeconds)).toString().padStart(2, "0")}s`
    : "00s"

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full border border-zinc-900 bg-black px-3 py-2">
      <span
        className={`h-2 w-2 rounded-full ${
          media ? "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.55)]" : "bg-zinc-700"
        }`}
      />
      <div className="min-w-0">
        <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
          {media ? "Active footage attached" : "No footage attached"}
        </p>
        <p className="truncate text-xs font-bold text-zinc-400">
          {media?.name || "Record or choose file"}
        </p>
      </div>
      <div className="grid justify-items-end gap-0.5">
        <span className="font-mono text-xs font-black text-zinc-500">{duration}</span>
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-700">
          {media?.source || "media"}
        </span>
      </div>
    </div>
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
