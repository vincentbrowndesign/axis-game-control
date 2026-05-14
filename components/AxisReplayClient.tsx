"use client"

import MobileVideoUpload from "./MobileVideoUpload"

type Props = {
  sessionId: string
}

export default function AxisReplayClient({
  sessionId,
}: Props) {
  const hasVideo = sessionId !== "demo"

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-[820px]">
        <div className="mb-10">
          <p className="mb-5 text-xs tracking-[0.5em] text-white/30">
            AXIS SESSION
          </p>

          <h1 className="text-[72px] font-black leading-[0.85] tracking-[-0.08em]">
            AXIS
            <br />
            REPLAY
          </h1>

          <p className="mt-6 text-[24px] text-white/55">
            Axis remembers how you play.
          </p>
        </div>

        {!hasVideo ? (
          <div className="rounded-[42px] border border-white/10 bg-[#050505] p-5">
            <MobileVideoUpload />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[42px] border border-white/10 bg-[#050505]">
            <video
              controls
              playsInline
              preload="metadata"
              className="
                w-full
                rounded-[42px]
                bg-black
                object-cover
              "
            >
              <source
                src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
                type="video/mp4"
              />
            </video>
          </div>
        )}
      </div>
    </main>
  )
}