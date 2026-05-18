import type { TrackInference } from "@/lib/engine/inference"

export function TrackRail({ inference }: { inference: TrackInference }) {
  const rows = [
    ["Control", inference.control],
    ["Momentum", inference.momentum],
    ["Instability", inference.instability],
    ["Recovery", inference.recovery],
    ["Pressure", inference.pressure],
    ["Streak", inference.streak],
    ["Shift", inference.shift],
  ]

  return (
    <aside className="grid gap-4">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
        Track
      </p>
      <div className="grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-zinc-800 pb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
              {label}
            </p>
            <p className="mt-1 text-lg font-black leading-tight text-zinc-100">
              {value}
            </p>
          </div>
        ))}
      </div>
    </aside>
  )
}
