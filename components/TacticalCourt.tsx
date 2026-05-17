export type CourtHighlight =
  | "top"
  | "slot"
  | "corner"
  | "paint"
  | "baseline"
  | "wing"
  | "weakSide"
  | "screen"
  | "tag"
  | "collapse"
  | "help"

type Props = {
  title?: string
  highlight?: CourtHighlight
  labels?: string[]
}

const highlightClass: Record<CourtHighlight, string> = {
  top: "left-[39%] top-[10%] h-[22%] w-[22%]",
  slot: "left-[20%] top-[25%] h-[23%] w-[21%]",
  corner: "right-[4%] bottom-[8%] h-[19%] w-[22%]",
  paint: "left-[36%] bottom-[19%] h-[33%] w-[28%]",
  baseline: "left-[13%] bottom-[7%] h-[16%] w-[74%]",
  wing: "right-[10%] top-[34%] h-[25%] w-[20%]",
  weakSide: "left-[7%] top-[34%] h-[43%] w-[29%]",
  screen: "left-[40%] top-[25%] h-[20%] w-[20%]",
  tag: "left-[24%] bottom-[27%] h-[24%] w-[22%]",
  collapse: "right-[5%] bottom-[9%] h-[38%] w-[31%]",
  help: "left-[34%] bottom-[30%] h-[29%] w-[32%]",
}

const zoneLabels: Record<CourtHighlight, string> = {
  top: "Top",
  slot: "Slot",
  corner: "Corner",
  paint: "Paint",
  baseline: "Baseline",
  wing: "Wing",
  weakSide: "Weak side",
  screen: "Screen",
  tag: "Tag",
  collapse: "Collapse",
  help: "Help",
}

export default function TacticalCourt({
  title = "Half court",
  highlight = "top",
  labels = [],
}: Props) {
  const visibleLabels = labels.filter(Boolean).slice(0, 4)

  return (
    <div className="relative min-h-[280px] overflow-hidden border border-stone-200/10 bg-[#11100d] shadow-[inset_0_0_80px_rgba(0,0,0,0.55)] sm:aspect-[16/10]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_72%,rgba(180,129,55,0.16),transparent_36%),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(0deg,rgba(180,129,55,0.055)_1px,transparent_1px)] bg-[length:auto,42px_42px,100%_38px]" />
      <div className="absolute inset-x-[5%] bottom-[7%] top-[7%] border border-amber-100/18" />
      <div className="absolute left-1/2 top-[7%] h-[86%] border-l border-amber-100/10" />
      <div className="absolute bottom-[7%] left-[32%] h-[39%] w-[36%] border border-amber-100/18" />
      <div className="absolute bottom-[7%] left-[39%] h-[18%] w-[22%] border border-amber-100/12" />
      <div className="absolute bottom-[37%] left-[39%] h-[27%] w-[22%] rounded-t-full border border-amber-100/12" />
      <div className="absolute bottom-[6.5%] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-amber-100/45" />
      <div className="absolute bottom-[7%] left-[17%] h-[60%] w-[66%] rounded-t-full border border-amber-100/10 border-b-transparent" />
      <div className="absolute bottom-[7%] left-[8%] h-[24%] w-[18%] border border-amber-100/7" />
      <div className="absolute bottom-[7%] right-[8%] h-[24%] w-[18%] border border-amber-100/7" />

      <div
        className={`absolute ${highlightClass[highlight]} border border-amber-200/45 bg-amber-200/12 shadow-[0_0_34px_rgba(217,166,83,0.08)]`}
      >
        <span className="absolute left-2 top-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-100/75">
          {zoneLabels[highlight]}
        </span>
      </div>

      <div className="absolute left-4 top-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-300/45">
          System
        </p>
        <p className="mt-1 text-lg font-black tracking-[-0.03em] text-stone-100">
          {title}
        </p>
      </div>

      {visibleLabels.length ? (
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-x-4 gap-y-2">
          {visibleLabels.map((label) => (
            <span
              key={label}
              className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-200/62"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
