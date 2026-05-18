import Link from "next/link"
import type { Run } from "@/lib/run/runState"

const nav = [
  { href: "/tap", label: "Tap" },
  { href: "/track", label: "Track" },
  { href: "/store", label: "Store" },
]

export function RunHeader({
  run,
  elapsed,
  mode,
  onName,
}: {
  run: Run
  elapsed: string
  mode: "tap" | "track" | "store"
  onName: (side: "home" | "away", value: string) => void
}) {
  return (
    <header className="grid gap-5">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/tap"
          className="text-sm font-black uppercase tracking-[0.18em] text-zinc-200"
        >
          Axis
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/80 p-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                mode === item.label.toLowerCase()
                  ? "bg-zinc-100 text-black"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 border-y border-zinc-800 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <input
          value={run.home}
          onChange={(event) => onName("home", event.target.value)}
          aria-label="Home"
          className="min-w-0 bg-transparent text-5xl font-black leading-none tracking-[-0.05em] text-orange-300 outline-none sm:text-7xl"
        />
        <div className="font-mono text-4xl font-black tracking-[-0.04em] text-emerald-300 sm:text-6xl">
          {elapsed}
        </div>
        <input
          value={run.away}
          onChange={(event) => onName("away", event.target.value)}
          aria-label="Away"
          className="min-w-0 bg-transparent text-left text-5xl font-black leading-none tracking-[-0.05em] text-sky-300 outline-none sm:text-right sm:text-7xl"
        />
      </div>
    </header>
  )
}
