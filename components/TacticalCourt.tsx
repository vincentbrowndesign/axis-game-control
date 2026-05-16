type Props = {
  title?: string
  highlight?: "top" | "slot" | "corner" | "paint" | "baseline" | "wing"
  labels?: string[]
}

const highlightClass: Record<NonNullable<Props["highlight"]>, string> = {
  top: "left-[42%] top-[15%] h-[18%] w-[16%]",
  slot: "left-[25%] top-[25%] h-[18%] w-[18%]",
  corner: "right-[5%] bottom-[9%] h-[16%] w-[20%]",
  paint: "left-[38%] bottom-[22%] h-[28%] w-[24%]",
  baseline: "left-[18%] bottom-[8%] h-[14%] w-[64%]",
  wing: "right-[12%] top-[36%] h-[22%] w-[18%]",
}

export default function TacticalCourt({
  title = "Half court",
  highlight = "top",
  labels = [],
}: Props) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden border border-white/10 bg-black">
      <div className="absolute inset-x-[6%] bottom-[7%] top-[7%] border border-white/15" />
      <div className="absolute left-1/2 top-[7%] h-[86%] border-l border-white/10" />
      <div className="absolute bottom-[7%] left-[32%] h-[38%] w-[36%] border border-white/15" />
      <div className="absolute bottom-[7%] left-[39%] h-[18%] w-[22%] border border-white/10" />
      <div className="absolute bottom-[37%] left-[39%] h-[26%] w-[22%] rounded-t-full border border-white/10" />
      <div className="absolute bottom-[6%] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/35" />
      <div className={`absolute ${highlightClass[highlight]} border border-lime-300/45 bg-lime-300/10`} />
      <div className="absolute left-3 top-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
        {title}
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
        {labels.slice(0, 4).map((label) => (
          <span
            key={label}
            className="border border-white/10 bg-zinc-950/80 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/55"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
