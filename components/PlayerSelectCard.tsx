"use client"

import AxisCard from "@/components/layout/AxisCard"
import AxisButton from "@/components/layout/AxisButton"

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
    <AxisCard>
      <p className="text-[11px] uppercase tracking-[0.42em] text-zinc-600">
        Identity Link
      </p>

      <h2 className="mt-5 text-[68px] font-black leading-[0.88] tracking-[-0.08em]">
        WHO IS
        <br />
        THIS?
      </h2>

      <p className="mt-6 text-[22px] leading-[1.6] text-zinc-400">
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
            className="rounded-[30px] border border-white/10 bg-black/40 p-5 text-left transition-all active:scale-[0.985]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[54px] font-black tracking-[-0.06em]">
                  {player.name}
                </h3>

                <p className="mt-2 text-[20px] text-zinc-400">
                  Class of {player.gradYear}
                </p>
              </div>

              <div className="rounded-full border border-white/10 px-5 py-3 text-[11px] uppercase tracking-[0.38em] text-zinc-500">
                {player.lastSeen}
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <Info
                label="Height"
                value={player.height}
              />

              <Info
                label="Weight"
                value={player.weight}
              />

              <Info
                label="Position"
                value={player.position}
              />

              <Info
                label="Dominant"
                value={player.handedness}
              />
            </div>
          </button>
        ))}
      </div>

      <AxisButton className="mt-6 bg-black text-white border border-white/10">
        Create New Player
      </AxisButton>
    </AxisCard>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-zinc-950 p-4">
      <p className="text-[11px] uppercase tracking-[0.38em] text-zinc-600">
        {label}
      </p>

      <p className="mt-4 text-[28px] font-bold tracking-[-0.04em]">
        {value}
      </p>
    </div>
  )
}