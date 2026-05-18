import type { Run } from "@/lib/run/runState"
import { formatRunTime } from "@/lib/run/runState"

export function MemoryRail({ run }: { run: Run }) {
  return (
    <section className="grid gap-4">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
        Store
      </p>
      <div className="grid gap-3">
        {run.moments.length ? (
          run.moments.map((moment) => (
            <div
              key={moment.id}
              className="border border-zinc-800 bg-zinc-950/70 p-4"
            >
              <p className="text-xl font-black uppercase tracking-[-0.03em] text-zinc-100">
                {moment.label}
              </p>
              <p className="mt-2 font-mono text-sm font-black text-zinc-500">
                {formatRunTime(moment.start)} - {formatRunTime(moment.end)}
              </p>
            </div>
          ))
        ) : (
          <div className="border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-xl font-black text-zinc-100">Tap the signal.</p>
            <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">
              Track the shift. Store the memory.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
