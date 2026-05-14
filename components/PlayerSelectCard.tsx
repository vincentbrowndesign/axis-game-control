"use client"

export type Player = {
  id: string
  name: string
  gradYear: string
  height: string
  weight: string
  position: string
  handedness: string
  lastSeen: string
}

type Props = {
  players?: Player[]
  onContinue?: (playerId: string) => void
}

const defaultPlayers: Player[] = [
  {
    id: "hudson",
    name: "Hudson",
    gradYear: "2032",
    height: "5'3",
    weight: "95",
    position: "Guard",
    handedness: "Right",
    lastSeen: "Yesterday",
  },
  {
    id: "ant",
    name: "Ant",
    gradYear: "2031",
    height: "5'6",
    weight: "110",
    position: "Wing",
    handedness: "Left",
    lastSeen: "2 Sessions Ago",
  },
]

export default function PlayerSelectCard({
  players = defaultPlayers,
  onContinue,
}: Props) {
  return (
    <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
      <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-600">
        Identity Link
      </p>

      <h2 className="mt-5 text-5xl font-black tracking-[-0.06em] leading-none">
        WHO IS
        <br />
        THIS?
      </h2>

      <p className="mt-5 text-xl leading-relaxed text-zinc-400">
        Axis can connect this session to an
        existing player memory profile.
      </p>

      <div className="mt-8 flex flex-col gap-5">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() =>
              onContinue?.(player.id)
            }
            className="rounded-[30px] border border-white/10 bg-black/40 p-5 text-left active:scale-[0.98]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-4xl font-black tracking-[-0.05em]">
                  {player.name}
                </h3>

                <p className="mt-2 text-xl text-zinc-400">
                  Class of {player.gradYear}
                </p>
              </div>

              <div className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-zinc-500">
                {player.lastSeen}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-white/10 bg-zinc-950 p-4">
                <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
                  Height
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {player.height}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-zinc-950 p-4">
                <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
                  Weight
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {player.weight}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-zinc-950 p-4">
                <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
                  Position
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {player.position}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-zinc-950 p-4">
                <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
                  Dominant
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {player.handedness}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <a
        href="/player/new"
        className="mt-6 block w-full rounded-full border border-white/10 bg-black py-5 text-center text-lg font-black text-white"
      >
        Create New Player
      </a>
    </section>
  )
}