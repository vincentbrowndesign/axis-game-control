type MomentumBarProps = {
  homeValue: number;
  awayValue: number;
};

export default function MomentumBar({
  homeValue,
  awayValue,
}: MomentumBarProps) {
  const total = Math.max(homeValue + awayValue, 1);
  const homeWidth = `${Math.max(8, (homeValue / total) * 100)}%`;
  const awayWidth = `${Math.max(8, (awayValue / total) * 100)}%`;

  return (
    <section className="border border-white/10 bg-[#0b0b0b] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-bold tracking-[0.28em] text-white/30">
            MOMENTUM
          </div>
          <div className="mt-1 text-[18px] font-black tracking-[-0.04em]">
            FLOW
          </div>
        </div>

        <div className="text-right text-[11px] font-bold tracking-[0.18em] text-white/35">
          LIVE
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-bold text-white/50">
            <span>HOME</span>
            <span>{homeValue}</span>
          </div>
          <div className="h-[10px] bg-white/10">
            <div className="h-full bg-white" style={{ width: homeWidth }} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-[11px] font-bold text-white/50">
            <span>AWAY</span>
            <span>{awayValue}</span>
          </div>
          <div className="h-[10px] bg-white/10">
            <div className="h-full bg-[#ffb800]" style={{ width: awayWidth }} />
          </div>
        </div>
      </div>
    </section>
  );
}