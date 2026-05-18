import Link from "next/link"
import { Activity } from "lucide-react"

export function ControlBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-black/92 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-center">
        <Link
          href="/track"
          aria-label="Track"
          title="Track"
          className="grid h-12 min-w-12 place-items-center rounded-full border border-emerald-500/30 bg-zinc-950 px-3 text-emerald-200 transition hover:border-emerald-300/60 hover:text-white"
        >
          <Activity className="h-5 w-5 stroke-[1.7]" />
        </Link>
      </div>
    </div>
  )
}
