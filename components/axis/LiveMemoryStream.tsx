"use client"

import MuxPlayer from "@mux/mux-player-react"

export function LiveMemoryStream() {
  const playbackId = process.env.NEXT_PUBLIC_MUX_PLAYBACK_ID || ""

  return (
    <main className="min-h-screen overflow-hidden bg-black text-zinc-100">
      <section className="relative grid min-h-screen place-items-center bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(244,244,245,0.08),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.2),rgba(0,0,0,0.96))]" />

        <header className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between rounded-full border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-100">
            AXIS
          </p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-200">
              LIVE
            </span>
          </div>
        </header>

        <div className="relative z-10 w-full max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-zinc-900 bg-zinc-950 shadow-[0_28px_100px_rgba(0,0,0,0.55)]">
            <div className="aspect-video bg-black">
              {playbackId ? (
                <MuxPlayer
                  playbackId={playbackId}
                  streamType="live"
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full"
                  style={{
                    ["--media-object-fit" as string]: "cover",
                  }}
                />
              ) : (
                <div className="grid h-full place-items-center px-6 text-center">
                  <div>
                    <p className="text-3xl font-black uppercase tracking-[-0.04em] text-zinc-100 sm:text-5xl">
                      MUX PLAYBACK ID MISSING
                    </p>
                    <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">
                      Set NEXT_PUBLIC_MUX_PLAYBACK_ID to load the live stream.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="absolute bottom-5 left-4 right-4 z-20 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
            LIVE MEMORY THREAD
          </p>
        </footer>
      </section>
    </main>
  )
}
