"use client"

type Props = {
  confidence: string
  basketballLikely: boolean
}

export default function InferencePanel({
  confidence,
  basketballLikely
}: Props) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/30">
            Environment
          </p>

          <h3 className="mt-2 text-2xl font-black text-white">
            {basketballLikely
              ? "Basketball Detected"
              : "Unknown Environment"}
          </h3>
        </div>

        <div className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white">
          {confidence}
        </div>
      </div>
    </div>
  )
}