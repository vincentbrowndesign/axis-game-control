type Props = {
  sessions: number
}

export default function MemoryProfile({
  sessions,
}: Props) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
      <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        Axis Memory
      </div>

      <div className="mt-4 text-5xl font-black text-white">
        {sessions}
      </div>

      <div className="mt-2 text-zinc-400">
        connected sessions remembered
      </div>
    </div>
  )
}