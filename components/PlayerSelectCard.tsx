"use client"

type Player = {
  id: string
  name: string
  gradYear: string
  height: string
  position: string
  lastSeen: string
}

type Props = {
  onContinue?: (playerId: string) => void
}

const players: Player[] = [
  {
    id: "hudson",
    name: "Hudson",
    gradYear: "2032",
    height: "5'3",
    position: "Guard",
    lastSeen: "2 sessions ago",
  },
  {
    id: "ant",
    name: "Ant",
    gradYear: "2031",
    height: "5'6",
    position: "Wing",
    lastSeen: "Yesterday",
  },
]

export default function PlayerSelectCard({
  onContinue,
}: Props) {
  return (
    <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
      <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-600">
        Identity Link
      </p>

      <h2 className="mt-5 text-4xl font-black tracking-[-0.05em]">
        WHO IS THIS?
      </h2>

      <p className="mt-3 text-zinc-400 leading-relaxed">
        Axis can connect this session to an existing
        player memory profile.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() =>
              onContinue?.(player.id)
            }
            className="rounded-[28px] border border-white/10 bg-black p-5 text-left transition active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-black">
                  {player.name}
                </h3>

                <p className="mt-2 text-sm text-zinc-500">
                  Class of {player.gradYear}
                </p>
              </div>

              <div className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                {player.lastSeen}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                  Height
                </p>

                <p className="mt-2 text-sm text-zinc-300">
                  {player.height}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                  Position
                </p>

                <p className="mt-2 text-sm text-zinc-300">
                  {player.position}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                  Memory
                </p>

                <p className="mt-2 text-sm text-zinc-300">
                  Active
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button className="mt-5 w-full rounded-full border border-white/10 bg-black py-4 text-base font-bold text-white">
        Create New Player
      </button>
    </section>
  )
}