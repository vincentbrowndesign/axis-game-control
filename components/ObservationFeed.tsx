import { AxisObservation } from "@/types/axis"
import { confidenceLabel } from "@/engine/confidenceEngine"

type Props = {
  observations: AxisObservation[]
}

export default function ObservationFeed({
  observations,
}: Props) {
  return (
    <div className="space-y-4">
      {observations.map((item) => (
        <div
          key={item.id}
          className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              Observation
            </div>

            <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              {confidenceLabel(item.confidence)}
            </div>
          </div>

          <div className="mt-4 text-2xl font-bold leading-tight text-white">
            {item.text}
          </div>

          <div className="mt-4 text-sm text-zinc-500">
            {item.confidence}% confidence
          </div>
        </div>
      ))}
    </div>
  )
}