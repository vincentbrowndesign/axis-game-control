type ScorebugProps = {
  homeScore: number;
  awayScore: number;
  possession: "HOME" | "AWAY";
  quarter: string;
  runLabel: string;
  pressureLabel: string;
  pressureTone: "neutral" | "warning" | "danger";
};

export default function Scorebug({
  homeScore,
  awayScore,
  possession,
  quarter,
  runLabel,
  pressureLabel,
  pressureTone,
}: ScorebugProps) {
  const tone =
    pressureTone === "danger"
      ? "text-[#ff3347]"
      : pressureTone === "warning"
      ? "text-[#ffb800]"
      : "text-white/70";

  return (
    <section className="w-full border border-white/10 bg-[#0b0b0b]">
      <div className="grid grid-cols-[1fr_auto]">
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between text-[10px] font-bold tracking-[0.28em] text-white/35">
            <span>AXIS</span>
            <span>{quarter}</span>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[18px] font-black tracking-[-0.04em]">
                  HOME
                </span>
                <span className="text-[42px] font-black leading-none tracking-[-0.08em]">
                  {homeScore}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[18px] font-black tracking-[-0.04em]">
                  AWAY
                </span>
                <span className="text-[42px] font-black leading-none tracking-[-0.08em]">
                  {awayScore}
                </span>
              </div>
            </div>

            <div className="flex w-[78px] flex-col justify-between border-l border-white/10 pl-3">
              <div>
                <div className="text-[9px] font-bold tracking-[0.22em] text-white/30">
                  POSS
                </div>
                <div className="mt-1 text-[15px] font-black">{possession}</div>
              </div>

              <div>
                <div className="text-[9px] font-bold tracking-[0.22em] text-white/30">
                  RUN
                </div>
                <div className="mt-1 text-[15px] font-black">{runLabel}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={`w-[8px] ${pressureTone === "danger" ? "bg-[#ff3347]" : pressureTone === "warning" ? "bg-[#ffb800]" : "bg-white/20"}`} />
      </div>

      <div className="border-t border-white/10 px-4 py-2">
        <div className="text-[9px] font-bold tracking-[0.28em] text-white/30">
          PRESSURE
        </div>
        <div className={`mt-1 text-[15px] font-black tracking-[-0.03em] ${tone}`}>
          {pressureLabel}
        </div>
      </div>
    </section>
  );
}