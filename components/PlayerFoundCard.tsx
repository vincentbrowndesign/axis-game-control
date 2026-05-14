type Props = {
  playerName?: string | null
  jersey?: string | null
  onContinue: () => void
}

export default function PlayerFoundCard({
  playerName,
  jersey,
  onContinue,
}: Props) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
      <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
        Identity
      </p>

      <h2 className="mt-5 text-4xl font-black tracking-[-0.05em] text-white">
        PLAYER FOUND
      </h2>

      <p className="mt-3 text-zinc-400">
        {playerName || "Unknown player"}
        {jersey ? ` · #${jersey}` : ""}
      </p>

      <p className="mt-2 text-zinc-500">
        Identity attached to this session.
      </p>

      <button
        onClick={onContinue}
        className="mt-7 w-full rounded-full bg-white py-4 text-base font-black text-black"
      >
        Continue
      </button>
    </div>
  )
}