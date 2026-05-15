import { AxisObservation } from "@/types/axis"

type Props = {
  observations: AxisObservation[]
}

function confidenceLabel(score: number) {
  if (score >= 88) return "HIGH"
  if (score >= 74) return "MEDIUM"
  return "LOW"
}

export default function ObservationFeed({
  observations,
}: Props) {
  if (!observations.length) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
          Observations
        </p>

        <h2 className="mt-4 text-3xl font-black text-white">
          Memory stored.
        </h2>

        <p className="mt-4 text-zinc-500">
          Replay ready. The read builds as more movement is archived.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {observations.map((item) => (
        <div
          key={item.id}
          className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
              Observation
            </p>

            <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
              {confidenceLabel(item.confidence)}
            </p>
          </div>

          <h2 className="mt-5 text-3xl font-black leading-tight text-white">
            {item.title}
          </h2>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-black p-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-600">
              Proof
            </p>

            <p className="mt-2 text-zinc-300">
              {item.proof}
            </p>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-black p-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-600">
              Why it matters
            </p>

            <p className="mt-2 text-zinc-300">
              {item.why}
            </p>
          </div>

          <p className="mt-5 text-sm text-zinc-500">
            {item.confidence}% confidence
          </p>
        </div>
      ))}
    </div>
  )
}
