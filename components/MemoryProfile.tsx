type Props = {
  sessions: number
  events: number
  observations: number
}

export default function MemoryProfile({
  sessions,
  events,
  observations,
}: Props) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
      <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
        Axis Memory
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div>
          <p className="text-4xl font-black text-white">
            {sessions}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            sessions
          </p>
        </div>

        <div>
          <p className="text-4xl font-black text-white">
            {events}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            events
          </p>
        </div>

        <div>
          <p className="text-4xl font-black text-white">
            {observations}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            reads
          </p>
        </div>
      </div>
    </div>
  )
}