"use client"

type Props = {
  sessionId?: string
  playbackId?: string | null
  videoUrl?: string | null
  className?: string
}

export default function AxisReplayClient({
  sessionId,
  playbackId,
  videoUrl,
  className = "",
}: Props) {
  const finalUrl =
    videoUrl ||
    (playbackId
      ? `https://stream.mux.com/${playbackId}.m3u8`
      : null)

  return (
    <section className={className}>
      {finalUrl ? (
        <div className="overflow-hidden rounded-[42px] border border-white/10 bg-black">
          <video
            src={finalUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full bg-black"
          />
        </div>
      ) : (
        <div className="flex min-h-[360px] items-center justify-center rounded-[42px] border border-white/10 bg-black p-8 text-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.45em] text-zinc-600">
              Replay Pending
            </p>

            <h2 className="mt-5 text-4xl font-black tracking-[-0.05em]">
              SESSION SAVED
            </h2>

            <p className="mt-4 text-zinc-500">
              Video will appear after upload completes.
            </p>

            {sessionId && (
              <p className="mt-6 break-all rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-600">
                {sessionId}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}