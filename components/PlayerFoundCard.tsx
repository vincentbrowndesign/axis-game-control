type Props = {
  onContinue: () => void
}

export default function PlayerFoundCard({
  onContinue,
}: Props) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
      <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        Identity
      </div>

      <div className="mt-4 text-3xl font-black text-white">
        PLAYER FOUND
      </div>

      <div className="mt-2 text-zinc-400">
        92% confidence match
      </div>

      <button
        onClick={onContinue}
        className="mt-6 w-full rounded-full bg-white py-4 text-sm font-bold text-black"
      >
        Continue
      </button>
    </div>
  )
}