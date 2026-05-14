"use client"

import { useEffect, useMemo, useState } from "react"
import PlayerSelectCard from "./PlayerSelectCard"

type Props = {
  sessionId: string
}

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

const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Hudson",
    gradYear: "2032",
    height: "5'3",
    weight: "95",
    position: "Guard",
    dominant: "Right",
    lastSeen: "Yesterday",
  },
  {
    id: "2",
    name: "Ant",
    gradYear: "2031",
    height: "5'6",
    weight: "110",
    position: "Wing",
    dominant: "Left",
    lastSeen: "2 Sessions Ago",
  },
]

export default function AxisReplayClient({ sessionId }: Props) {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/session/${sessionId}`)

        if (!res.ok) {
          setLoading(false)
          return
        }

        const data = await res.json()
        setSession(data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId])

  const playbackId = useMemo(() => {
    return session?.playbackId || session?.muxPlaybackId
  }, [session])

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <div className="text-sm tracking-[0.35em] text-zinc-500 mb-6">
          AXIS SESSION
        </div>

        <h1 className="text-6xl font-black leading-[0.9]">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="text-zinc-400 mt-6 text-xl">
          Loading session...
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-[11px] tracking-[0.45em] text-zinc-600 mb-5">
          AXIS SESSION
        </div>

        <h1 className="text-[72px] leading-[0.82] font-black tracking-[-0.06em]">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="text-zinc-500 text-[18px] mt-6 mb-8">
          Axis remembers how you play.
        </p>

        <section className="rounded-[38px] overflow-hidden border border-zinc-900 bg-[#050505] mb-8">
          {playbackId ? (
            <video
              className="w-full aspect-[9/16] object-cover"
              controls
              playsInline
              src={`https://stream.mux.com/${playbackId}.m3u8`}
            />
          ) : (
            <div className="aspect-[9/16] flex items-center justify-center text-zinc-600">
              No video found
            </div>
          )}
        </section>

        {!selectedPlayer ? (
          <section className="rounded-[38px] border border-zinc-900 bg-[#050505] p-7 mb-8">
            <div className="text-[11px] tracking-[0.45em] text-zinc-600 mb-5">
              IDENTITY LINK
            </div>

            <h2 className="text-[72px] leading-[0.82] font-black tracking-[-0.06em]">
              WHO IS
              <br />
              THIS?
            </h2>

            <p className="text-zinc-500 text-[18px] mt-6 mb-10 max-w-xl">
              Axis can connect this session to an existing player memory profile.
            </p>

            <div className="space-y-6">
              {mockPlayers.map((player) => (
                <PlayerSelectCard
                  key={player.id}
                  player={player}
                  onSelect={() => setSelectedPlayer(player)}
                />
              ))}
            </div>

            <button className="w-full mt-7 rounded-[28px] bg-white text-black py-5 text-2xl font-semibold">
              Create New Player
            </button>
          </section>
        ) : (
          <>
            <section className="rounded-[38px] border border-zinc-900 bg-[#050505] p-7 mb-8">
              <div className="text-[11px] tracking-[0.45em] text-zinc-600 mb-6">
                AXIS MEMORY
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-6xl font-black">1</div>
                  <div className="text-zinc-500 mt-2">session</div>
                </div>

                <div>
                  <div className="text-6xl font-black">4</div>
                  <div className="text-zinc-500 mt-2">events</div>
                </div>

                <div>
                  <div className="text-6xl font-black">3</div>
                  <div className="text-zinc-500 mt-2">reads</div>
                </div>
              </div>
            </section>

            <section className="rounded-[38px] border border-zinc-900 bg-[#050505] p-7 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[11px] tracking-[0.45em] text-zinc-600">
                  CONNECTED EVENTS
                </div>

                <div className="text-[11px] tracking-[0.45em] text-zinc-600">
                  MEMORY
                </div>
              </div>

              <div className="space-y-4">
                {[
                  ["0:04", "DRIVE"],
                  ["0:05", "PAINT TOUCH"],
                  ["0:06", "SHOT"],
                  ["0:07", "MAKE"],
                ].map(([time, label]) => (
                  <div
                    key={label}
                    className="rounded-[28px] border border-zinc-900 bg-black px-6 py-5 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-zinc-600 text-sm mb-2">
                        {time}
                      </div>

                      <div className="text-4xl font-bold tracking-[-0.04em]">
                        {label}
                      </div>
                    </div>

                    <div className="w-3 h-3 rounded-full bg-white" />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6 pb-20">
              {[
                {
                  level: "HIGH",
                  title:
                    "Your best scoring windows appeared before help established.",
                  proof:
                    "This possession created pressure immediately after the first paint touch.",
                  why:
                    "Early attacks create cleaner reads before the defense stabilizes.",
                  confidence: "92%",
                },
                {
                  level: "HIGH",
                  title:
                    "Paint pressure increased overall shot quality.",
                  proof:
                    "Axis connected DRIVE → PAINT TOUCH → SHOT → MAKE.",
                  why:
                    "The system remembers what consistently creates advantages over time.",
                  confidence: "89%",
                },
                {
                  level: "MEDIUM",
                  title:
                    "This session expanded your behavioral memory profile.",
                  proof:
                    "Movement timing, pressure creation, and finish behavior were attached to your identity layer.",
                  why:
                    "Axis is building long-term intelligence around how you actually play.",
                  confidence: "84%",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[38px] border border-zinc-900 bg-[#050505] p-7"
                >
                  <div className="flex items-center justify-between mb-7">
                    <div className="text-[11px] tracking-[0.45em] text-zinc-600">
                      OBSERVATION
                    </div>

                    <div className="text-[11px] tracking-[0.45em] text-zinc-600">
                      {item.level}
                    </div>
                  </div>

                  <h3 className="text-[54px] leading-[0.92] font-black tracking-[-0.06em] mb-8">
                    {item.title}
                  </h3>

                  <div className="rounded-[28px] border border-zinc-900 bg-black p-6 mb-5">
                    <div className="text-[11px] tracking-[0.45em] text-zinc-600 mb-4">
                      PROOF
                    </div>

                    <p className="text-2xl leading-[1.45] text-zinc-200">
                      {item.proof}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-zinc-900 bg-black p-6">
                    <div className="text-[11px] tracking-[0.45em] text-zinc-600 mb-4">
                      WHY IT MATTERS
                    </div>

                    <p className="text-2xl leading-[1.45] text-zinc-200">
                      {item.why}
                    </p>
                  </div>

                  <div className="mt-6 text-zinc-500 text-xl">
                    {item.confidence} confidence
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}