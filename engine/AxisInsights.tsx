"use client"

type Props = {
  insights: string[]
}

export default function AxisInsights({
  insights,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {insights.map((insight, index) => (
        <div
          key={index}
          className="border border-white/10 rounded-[24px] p-4"
        >
          <p className="text-white/70 text-sm tracking-[0.3em] uppercase">
            {insight}
          </p>
        </div>
      ))}
    </div>
  )
}