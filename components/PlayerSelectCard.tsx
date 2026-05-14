type Player = {
  id: string
  name: string
  gradYear: string
  height: string
  weight: string
  position: string
  dominant: string
  lastSeen: string
}

type Props = {
  player: Player
  onSelect: () => void
}

export default function PlayerSelectCard({
  player,
  onSelect,
}: Props) {
  return (
    <button
      onClick={onSelect}
      className="w-full rounded-[34px] border border-zinc-900 bg-black p-6 text-left transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-6xl leading-none font-black tracking-[-0.06em]">
            {player.name}
          </div>

          <div className="text-zinc-500 text-[20px] mt-3">
            Class of {player.gradYear}
          </div>
        </div>

        <div className="rounded-full border border-zinc-800 px-5 py-3 text-[11px] tracking-[0.35em] text-zinc-500 uppercase">
          {player.lastSeen}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InfoCard label="HEIGHT" value={player.height} />
        <InfoCard label="WEIGHT" value={player.weight} />
        <InfoCard label="POSITION" value={player.position} />
        <InfoCard label="DOMINANT" value={player.dominant} />
      </div>
    </button>
  )
}

function InfoCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[28px] border border-zinc-900 bg-[#050505] p-5 min-h-[138px] flex flex-col justify-between">
      <div className="text-[11px] tracking-[0.42em] text-zinc-600">
        {label}
      </div>

      <div className="text-[54px] leading-none font-black tracking-[-0.06em]">
        {value}
      </div>
    </div>
  )
}